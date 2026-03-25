import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authorsPath = path.join(__dirname, "../data/authors/authors.json");
const authors = JSON.parse(fs.readFileSync(authorsPath, "utf-8"));

// Get token from gh CLI so we don't hardcode it
const GITHUB_TOKEN = execSync("gh auth token", { encoding: "utf-8" }).trim();

const CONCURRENCY = 10; // parallel requests at a time
const DELAY_BETWEEN_BATCHES_MS = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const checkGithubUser = async (
  handle: string
): Promise<{ exists: boolean; twitterUsername?: string }> => {
  try {
    const res = await fetch(`https://api.github.com/users/${handle}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "User-Agent": "eip-tools-author-verify",
      },
    });
    if (res.status === 403 || res.status === 429) {
      console.warn(`Rate limited! Waiting 60s...`);
      await sleep(60000);
      return checkGithubUser(handle);
    }
    if (res.status === 200) {
      const data = await res.json();
      return { exists: true, twitterUsername: data.twitter_username || undefined };
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
};

const main = async () => {
  const handleAuthors = authors.filter((a: any) => a.type === "handle");
  const emailAuthors = authors.filter((a: any) => a.type === "email");
  const total = handleAuthors.length;
  let verified = 0;
  let notFound = 0;
  let withTwitter = 0;

  console.log(`Checking ${total} GitHub handles (${CONCURRENCY} concurrent)...`);

  for (let i = 0; i < handleAuthors.length; i += CONCURRENCY) {
    const batch = handleAuthors.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(async (author: any) => {
        const result = await checkGithubUser(author.handle);
        return { author, ...result };
      })
    );

    for (const { author, exists, twitterUsername } of results) {
      if (!exists) {
        delete author.github;
        notFound++;
      } else {
        verified++;
        if (twitterUsername) {
          author.twitter = `https://x.com/${twitterUsername}`;
          withTwitter++;
        } else {
          delete author.twitter;
        }
      }
    }

    const done = Math.min(i + CONCURRENCY, total);
    if (done % 50 === 0 || done === total) {
      console.log(`  ${done}/${total} checked (${verified} valid, ${notFound} not found)`);
    }

    await sleep(DELAY_BETWEEN_BATCHES_MS);
  }

  console.log(`\nDone: ${verified} valid GitHub, ${withTwitter} with Twitter linked, ${notFound} not found`);

  const result = [...handleAuthors, ...emailAuthors].sort(
    (a: any, b: any) => b.count - a.count
  );

  fs.writeFileSync(authorsPath, JSON.stringify(result, null, 2));
  console.log(`Updated ${authorsPath}`);
};

main();
