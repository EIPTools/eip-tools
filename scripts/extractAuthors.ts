import { convertMetadataToJson, extractMetadata } from "@/utils";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dirs = [
  { dir: path.join(__dirname, "../submodules/EIPs/EIPS"), prefix: "eip" },
  { dir: path.join(__dirname, "../submodules/ERCs/ERCS"), prefix: "erc" },
  { dir: path.join(__dirname, "../submodules/RIPs/RIPS"), prefix: "rip" },
  { dir: path.join(__dirname, "../submodules/CAIPs/CAIPs"), prefix: "caip" },
];

interface AuthorEntry {
  handle: string;
  count: number;
  type: "handle" | "email";
  github?: string;
  twitter?: string;
}

const authorCounts: Record<string, { count: number; type: "handle" | "email" }> = {};

for (const { dir, prefix } of dirs) {
  if (!fs.existsSync(dir)) continue;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const match = file.match(new RegExp(`^${prefix}-(\\d+)\\.md$`));
    if (!match) continue;

    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    const { metadata } = extractMetadata(content);
    const json = convertMetadataToJson(metadata);

    if (!json.author) continue;

    for (const authorEntry of json.author) {
      // Match (@handle) in parens first
      const handleMatch = authorEntry.match(/\(@(\w[\w-]*)\)/);
      if (handleMatch) {
        const handle = handleMatch[1];
        authorCounts[handle] = authorCounts[handle] || { count: 0, type: "handle" };
        authorCounts[handle].count++;
      } else {
        // Fall back to email address
        const emailMatch = authorEntry.match(/<([^>]+@[^>]+)>/);
        if (emailMatch) {
          const email = emailMatch[1];
          authorCounts[email] = authorCounts[email] || { count: 0, type: "email" };
          authorCounts[email].count++;
        }
      }
    }
  }
}

const authors: AuthorEntry[] = Object.entries(authorCounts)
  .map(([handle, { count, type }]) => ({
    handle,
    count,
    type,
    ...(type === "handle"
      ? { github: `https://github.com/${handle}`, twitter: `https://x.com/${handle}` }
      : {}),
  }))
  .sort((a, b) => b.count - a.count);

const outputPath = path.join(__dirname, "../data/authors/authors.json");
fs.writeFileSync(outputPath, JSON.stringify(authors, null, 2));
console.log(`Wrote ${authors.length} unique authors to ${outputPath}`);
