import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authorsPath = path.join(__dirname, "../data/authors/authors.json");
const cachePath = path.join(__dirname, "../data/authors/github-cache.json");
const authors = JSON.parse(fs.readFileSync(authorsPath, "utf-8"));

// Load cache of previously verified handles
// Format: { [handle]: { github: bool, twitter?: string } }
let cache: Record<string, { github: boolean; twitter?: string }> = {};
if (fs.existsSync(cachePath)) {
  cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
}

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
      return {
        exists: true,
        twitterUsername: data.twitter_username || undefined,
      };
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
};

const main = async () => {
  const handleAuthors = authors.filter((a: any) => a.type === "handle");
  const emailAuthors = authors.filter((a: any) => a.type === "email");

  // Split into cached and uncached
  const uncached = handleAuthors.filter((a: any) => !(a.handle in cache));
  const cached = handleAuthors.filter((a: any) => a.handle in cache);

  // Apply cached results immediately
  let verified = 0;
  let notFound = 0;
  let withTwitter = 0;

  for (const author of cached) {
    const entry = cache[author.handle];
    if (!entry.github) {
      delete author.github;
      notFound++;
    } else {
      verified++;
      if (entry.twitter) {
        author.twitter = `https://x.com/${entry.twitter}`;
        withTwitter++;
      } else {
        delete author.twitter;
      }
    }
  }

  console.log(
    `${cached.length} cached, ${uncached.length} new handles to check`
  );

  if (uncached.length > 0) {
    console.log(
      `Checking ${uncached.length} GitHub handles (${CONCURRENCY} concurrent)...`
    );

    for (let i = 0; i < uncached.length; i += CONCURRENCY) {
      const batch = uncached.slice(i, i + CONCURRENCY);

      const results = await Promise.all(
        batch.map(async (author: any) => {
          const result = await checkGithubUser(author.handle);
          return { author, ...result };
        })
      );

      for (const { author, exists, twitterUsername } of results) {
        // Update cache
        cache[author.handle] = {
          github: exists,
          twitter: twitterUsername,
        };

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

      const done = Math.min(i + CONCURRENCY, uncached.length);
      if (done % 50 === 0 || done === uncached.length) {
        console.log(
          `  ${done}/${uncached.length} checked (${verified} valid, ${notFound} not found)`
        );
      }

      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  console.log(
    `\nDone: ${verified} valid GitHub, ${withTwitter} with Twitter linked, ${notFound} not found`
  );

  // Save cache
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  console.log(`Cache saved (${Object.keys(cache).length} entries)`);

  const result = [...handleAuthors, ...emailAuthors].sort(
    (a: any, b: any) => b.count - a.count
  );

  fs.writeFileSync(authorsPath, JSON.stringify(result, null, 2));
  console.log(`Updated ${authorsPath}`);
};

main();
