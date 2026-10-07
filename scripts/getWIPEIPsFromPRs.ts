import { config } from "dotenv";
config({ path: ".env.local" });

import axios from "axios";
import { convertMetadataToJson, extractMetadata } from "@/utils";
import { ValidEIPs } from "@/types";

import { fetchRemoteMarkdown, githubSource, hasPRFileEvidence, isProposalMarkdown, proposalSourceFromPR, reconcilePRFile, trackedPRNumbers, type PRFile } from "@/utils/proposalContent";
import * as path from "path";
import { fileURLToPath } from "url";
import { updateFileData } from "./fetchValidEIPs";


// Import existing data for caching
import { validEIPs as existingEIPs } from "@/data/validEIPs";
import { validRIPs as existingRIPs } from "@/data/validRIPs";
import { validCAIPs as existingCAIPs } from "@/data/validCAIPs";

const __filename = fileURLToPath(import.meta.url);


const headers: Record<string, string> = process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {};
const readRemoteMarkdown = (url: string) => fetchRemoteMarkdown(url, (input, init) => fetch(input, {
  ...init, headers: { ...init?.headers, ...(new URL(String(input)).hostname === "api.github.com" ? headers : {}) },
}));

const MAX_RETRIES = 5;
// Concurrency control to make fetching faster but not trigger rate limits
const MAX_CONCURRENT_REQUESTS = 3;


/**
 * Process items with improved concurrency control and error handling
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  concurrencyLimit: number
): Promise<R[]> {
  const results: R[] = [];
  const errors: Error[] = [];
  let activePromises = 0;
  let itemIndex = 0;

  return new Promise((resolve, reject) => {
    const processNext = async () => {
      if (itemIndex >= items.length && activePromises === 0) {
        if (errors.length > 0) {
          console.warn(`Completed with ${errors.length} errors:`, errors);
        }
        resolve(results);
        return;
      }

      while (activePromises < concurrencyLimit && itemIndex < items.length) {
        const currentIndex = itemIndex++;
        activePromises++;

        processFn(items[currentIndex])
          .then((result) => {
            if (result) {
              results.push(result);
            }
          })
          .catch((error) => {
            errors.push(error);
            console.error(`Error processing item ${currentIndex}:`, error);
          })
          .finally(() => {
            activePromises--;
            processNext();
          });
      }
    };

    processNext();
  });
}

/**
 * Check GitHub API rate limit status
 */
async function checkRateLimit() {
  try {
    const response = await axios.get("https://api.github.com/rate_limit", {
      headers,
    });
    const { rate } = response.data;
    console.log(`GitHub API Rate Limit Status:
      Remaining: ${rate.remaining}/${rate.limit}
      Reset Time: ${new Date(rate.reset * 1000).toLocaleString()}
    `);
    return rate;
  } catch (error) {
    console.error("Failed to check rate limit:", error);
    return null;
  }
}

/**
 * Sleep with exponential backoff
 */
async function sleep(retryCount: number) {
  const baseDelay = 2000; // Start with 2 seconds
  const delay = baseDelay * Math.pow(2, retryCount - 1); // Exponential backoff
  const jitter = Math.random() * 1000; // Add some randomness
  await new Promise((res) => setTimeout(res, delay + jitter));
}

async function fetchWithRetry(
  url: string,
  options: any,
  retries = MAX_RETRIES
): Promise<any> {
  try {
    const response = await axios.get(url, options);

    // Check remaining rate limit from headers
    const remaining = response.headers["x-ratelimit-remaining"];
    const resetTime = response.headers["x-ratelimit-reset"];
    if (remaining && parseInt(remaining) < 100) {
      console.warn(`Warning: Rate limit running low. ${remaining} requests remaining.
        Reset at: ${new Date(parseInt(resetTime) * 1000).toLocaleString()}`);
    }

    return response;
  } catch (error: any) {
    if (error.response?.status === 403) {
      // Check if it's a rate limit issue
      if (error.response.headers["x-ratelimit-remaining"] === "0") {
        const resetTime = error.response.headers["x-ratelimit-reset"];
        const waitTime = parseInt(resetTime) * 1000 - Date.now();
        console.warn(
          `Rate limit exceeded. Reset in ${Math.ceil(waitTime / 1000)} seconds`
        );

        if (retries > 0) {
          // Wait until rate limit resets, plus a small buffer
          await sleep(MAX_RETRIES - retries + 1);
          return fetchWithRetry(url, options, retries - 1);
        }
      }
    }

    if (retries > 0) {
      console.warn(`Retrying... (${MAX_RETRIES - retries + 1})`);
      await sleep(MAX_RETRIES - retries + 1);
      return fetchWithRetry(url, options, retries - 1);
    } else {
      throw error;
    }
  }
}

async function getOpenPRNumbers(
  orgName: string,
  repo: string
): Promise<Array<number>> {
  console.log(`Fetching open PRs for ${orgName}/${repo}...`);
  const allPRs: Array<any> = [];
  let page = 1;
  const perPage = 100; // Maximum items per page allowed by GitHub API

  try {
    while (true) {
      const apiUrl = `https://api.github.com/repos/${orgName}/${repo}/pulls?state=open&per_page=${perPage}&page=${page}`;
      const response = await fetchWithRetry(apiUrl, { headers });
      const openPRs = response.data;

      if (openPRs.length === 0) {
        break; // No more pages to fetch
      }

      allPRs.push(...openPRs);

      // Check if there are more pages
      const linkHeader = response.headers.link;
      if (!linkHeader || !linkHeader.includes('rel="next"')) {
        break; // No more pages
      }

      page++;
      console.log(`Fetched page ${page - 1}, found ${openPRs.length} PRs...`);
    }

    console.log(`Total PRs found: ${allPRs.length}`);
    const prNumbers = allPRs.map((pr: { number: number }) => pr.number);
    return prNumbers;
  } catch (error) {
    console.error(`Failed to fetch open PRs: ${error}`);
    return [];
  }
}

async function getPRData(orgName: string, prNumber: number, repo: string) {
  const response = await fetchWithRetry(`https://api.github.com/repos/${orgName}/${repo}/pulls/${prNumber}`, { headers });
  // head.repo can be null after the contributor deletes their fork.
  return { prData: response.data };
}

async function getPRFileChanges(orgName: string, repo: string, prNumber: number): Promise<PRFile[]> {
  const files: PRFile[] = [];
  for (let page = 1; ; page++) {
    const response = await fetchWithRetry(`https://api.github.com/repos/${orgName}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`, { headers });
    if (!Array.isArray(response.data)) throw new Error("Invalid PR files");
    files.push(...response.data);
    if (response.data.length < 100) return files;
    if (page >= 30) throw new Error("Incomplete PR files");
  }
}

interface PRConfig { orgName: string; repo: string; folderName: string; filePrefix: string; isERC?: boolean }
interface PRLoaders {
  existing?: ValidEIPs;
  open?: typeof getOpenPRNumbers;
  pr?: typeof getPRData;
  files?: typeof getPRFileChanges;
  markdown?: (url: string) => Promise<string>;
  onRemove?: (key: string) => void;
}

export async function fetchDataFromPRs({ orgName, repo, folderName, filePrefix, isERC }: PRConfig, loaders: PRLoaders = {}): Promise<ValidEIPs> {
  const existing = loaders.existing ?? (repo === "RIPs" ? existingRIPs : repo === "CAIPs" ? existingCAIPs : existingEIPs);
  const kind = repo === "RIPs" ? "rip" : repo === "CAIPs" ? "caip" : "eip";
  // Refresh lifecycle every run, including previously indexed PRs now closed.
  const numbers = trackedPRNumbers(repo, await (loaders.open ?? getOpenPRNumbers)(orgName, repo), existing);
  const result: ValidEIPs = {};
  await processWithConcurrency(numbers, async prNo => {
    try {
      const [{ prData }, files] = await Promise.all([
        (loaders.pr ?? getPRData)(orgName, prNo, repo),
        (loaders.files ?? getPRFileChanges)(orgName, repo, prNo),
      ]);
      const pattern = new RegExp(`^${folderName}/${filePrefix}-(\\d+)\\.md$`);
      const candidates = new Map<string, ValidEIPs[string]>();
      for (const [key, proposal] of Object.entries(existing)) {
        if (proposal.prNo !== prNo || githubSource(proposal.markdownPath).repo !== repo) continue;
        const source = proposalSourceFromPR(kind, proposal, prData);
        const reconciled = reconcilePRFile(source, files);
        const finalKey = githubSource(reconciled.markdownPath).file.match(pattern)?.[1];
        if (source.prState === "merged" || (finalKey && finalKey !== key)) loaders.onRemove?.(key);
        if (source.prState === "merged" && proposal.prState !== "merged" && !hasPRFileEvidence(source, files)) continue;
        if (finalKey) candidates.set(finalKey, reconciled as ValidEIPs[string]);
      }
      for (const file of files) {
        const match = file.filename.match(pattern);
        if (!match || !["added", "renamed"].includes(file.status)) continue;
        const source = proposalSourceFromPR(kind, {
          title: "", isERC, prNo,
          markdownPath: `https://raw.githubusercontent.com/${orgName}/${repo}/refs/pull/${prNo}/head/${file.filename}`,
        }, prData);
        candidates.set(match[1], source as ValidEIPs[string]);
      }
      for (const [key, source] of Array.from(candidates)) {
        try {
          // The default-branch submodule is never evidence of PR content.
          const markdown = await (loaders.markdown ?? readRemoteMarkdown)(source.markdownPath);
          if (!isProposalMarkdown(markdown, source.markdownPath)) throw new Error("Invalid PR proposal Markdown");
          const { title, status, requires } = convertMetadataToJson(extractMetadata(markdown).metadata);
          result[key] = { ...source, title, status, requires, timestamp: new Date().toISOString() };
        } catch (error: any) {
          console.warn(`Could not refresh ${repo} PR #${prNo}, proposal ${key}: ${error.message}`);
        }
      }
    } catch (error: any) {
      // A lifecycle/files outage is not evidence for removing PR history.
      console.warn(`Could not refresh ${repo} PR #${prNo}: ${error.message}`);
    }
  }, MAX_CONCURRENT_REQUESTS);
  return result;
}

const updateEIPData = async () => {
  const removed = new Set<string>();
  console.log("Updating EIP data...");
  const resOpenEIPs = await fetchDataFromPRs({
    orgName: "ethereum",
    repo: "EIPs",
    folderName: "EIPS",
    filePrefix: "eip",
  }, { onRemove: key => removed.add(key) });
  console.log("Updating ERC data...");
  const resOpenERCs = await fetchDataFromPRs({
    orgName: "ethereum",
    repo: "ERCs",
    folderName: "ERCS",
    filePrefix: "erc",
    isERC: true,
  }, { onRemove: key => removed.add(key) });
  const result = { ...resOpenEIPs, ...resOpenERCs };

  await updateFileData(result, "valid-eips.json", removed);
  console.log("EIP/ERC data updated successfully!");
};

const updateRIPData = async () => {
  const removed = new Set<string>();
  console.log("Updating RIP data...");
  const resOpenRIPs = await fetchDataFromPRs({
    orgName: "ethereum",
    repo: "RIPs",
    folderName: "RIPS",
    filePrefix: "rip",
  }, { onRemove: key => removed.add(key) });

  await updateFileData(resOpenRIPs, "valid-rips.json", removed);
  console.log("RIP data updated successfully!");
};

const updateCAIPData = async () => {
  const removed = new Set<string>();
  console.log("Updating CAIP data...");
  const resOpenCAIPs = await fetchDataFromPRs({
    orgName: "ChainAgnostic",
    repo: "CAIPs",
    folderName: "CAIPs",
    filePrefix: "caip",
  }, { onRemove: key => removed.add(key) });

  await updateFileData(resOpenCAIPs, "valid-caips.json", removed);
  console.log("CAIP data updated successfully!");
};

const main = async () => {
  const startTime = Date.now();
  console.log("Starting data update process...");

  try {
    // Check rate limit before starting
    const rateLimit = await checkRateLimit();
    if (rateLimit && rateLimit.remaining < 100) {
      console.warn(
        `Warning: Low rate limit remaining (${rateLimit.remaining}). Consider waiting until reset.`
      );
      const waitTime = rateLimit.reset * 1000 - Date.now();
      if (waitTime > 0) {
        console.log(
          `Waiting ${Math.ceil(waitTime / 1000)} seconds for rate limit reset...`
        );
        await new Promise((res) => setTimeout(res, waitTime + 1000)); // Add 1 second buffer
      }
    }

    // Create performance monitoring object
    const perfMetrics: { [key: string]: number } = {};

    // Run all update functions in parallel with performance tracking
    const updateFunctions = [
      {
        name: "EIP/ERC",
        fn: updateEIPData,
      },
      {
        name: "RIP",
        fn: updateRIPData,
      },
      {
        name: "CAIP",
        fn: updateCAIPData,
      },
    ];

    await Promise.all(
      updateFunctions.map(async ({ name, fn }) => {
        const fnStartTime = Date.now();
        try {
          await fn();
          const fnEndTime = Date.now();
          perfMetrics[name] = (fnEndTime - fnStartTime) / 1000;
        } catch (error) {
          console.error(`Error updating ${name} data:`, error);
          throw error;
        }
      })
    );

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;

    // Log performance metrics
    console.log("\nPerformance Metrics:");
    console.log("-".repeat(50));
    Object.entries(perfMetrics).forEach(([name, time]) => {
      console.log(`${name.padEnd(15)} : ${time.toFixed(2)}s`);
    });
    console.log("-".repeat(50));
    console.log(`Total Execution Time: ${totalTime.toFixed(2)}s`);
  } catch (error) {
    console.error("Error in main execution:", error);
    process.exit(1);
  }
};

// Importing generation helpers must not mutate indexes or launch network work.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();
