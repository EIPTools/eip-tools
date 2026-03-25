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

interface Proposal {
  number: string;
  prefix: string;
  status: string;
}

interface AuthorEntry {
  handle: string;
  count: number;
  finalCount: number;
  type: "handle" | "email";
  proposals: Proposal[];
  github?: string;
  twitter?: string;
}

const authorData: Record<
  string,
  { count: number; finalCount: number; type: "handle" | "email"; proposals: Proposal[] }
> = {};

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

    const status = json.status || "Draft";
    const isFinal = status === "Final";
    const proposal: Proposal = { number: match[1], prefix, status };

    for (const authorEntry of json.author) {
      // Match (@handle) in parens first
      const handleMatch = authorEntry.match(/\(@(\w[\w-]*)\)/);
      if (handleMatch) {
        const handle = handleMatch[1];
        authorData[handle] = authorData[handle] || { count: 0, finalCount: 0, type: "handle", proposals: [] };
        authorData[handle].count++;
        authorData[handle].proposals.push(proposal);
        if (isFinal) authorData[handle].finalCount++;
      } else {
        // Fall back to email address
        const emailMatch = authorEntry.match(/<([^>]+@[^>]+)>/);
        if (emailMatch) {
          const email = emailMatch[1];
          authorData[email] = authorData[email] || { count: 0, finalCount: 0, type: "email", proposals: [] };
          authorData[email].count++;
          authorData[email].proposals.push(proposal);
          if (isFinal) authorData[email].finalCount++;
        }
      }
    }
  }
}

const authors: AuthorEntry[] = Object.entries(authorData)
  .map(([handle, { count, finalCount, type, proposals }]) => ({
    handle,
    count,
    finalCount,
    type,
    proposals,
    ...(type === "handle"
      ? { github: `https://github.com/${handle}`, twitter: `https://x.com/${handle}` }
      : {}),
  }))
  .sort((a, b) => b.count - a.count);

const outputPath = path.join(__dirname, "../data/authors/authors.json");
fs.writeFileSync(outputPath, JSON.stringify(authors, null, 2));
console.log(`Wrote ${authors.length} unique authors to ${outputPath}`);
