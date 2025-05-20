import { config } from "dotenv";
config({ path: ".env.local" });

import axios from "axios";
import { convertMetadataToJson, extractMetadata } from "@/utils";
import { ValidEIPs } from "@/types";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { updateFileData } from "./fetchValidEIPs";
import { execSync } from "child_process";

// Import existing data for caching
import { validEIPs as existingEIPs } from "@/data/validEIPs";
import { validRIPs as existingRIPs } from "@/data/validRIPs";
import { validCAIPs as existingCAIPs } from "@/data/validCAIPs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const headers = {
  Authorization: `token ${process.env.GITHUB_TOKEN}`,
};

const MAX_RETRIES = 5;
// Concurrency control to make fetching faster but not trigger rate limits
const MAX_CONCURRENT_REQUESTS = 3;
// Time in hours for which we consider cached data fresh enough
const CACHE_FRESHNESS_HOURS = 24 * 5;

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
  const apiUrl = `https://api.github.com/repos/${orgName}/${repo}/pulls/${prNumber}`;

  try {
    const response = await fetchWithRetry(apiUrl, { headers });
    const prData = response.data;

    // Instead of using the diffUrl from the API, we'll use local git operations
    const repoOwnerAndName = prData.head.repo.full_name;
    const branchName = prData.head.ref;
    const baseBranch = prData.base.ref;
    return { repoOwnerAndName, branchName, baseBranch, prData };
  } catch (error) {
    console.error(`Failed to fetch PR details: ${error}`);
  }
}

// Helper function to get the correct repository path
function getRepoPath(orgName: string, repo: string): string {
  // The submodules are in the 'submodules' directory
  return path.resolve(
    __dirname,
    "..",
    "submodules",
    orgName === "ChainAgnostic" ? "CAIPs" : repo
  );
}

// Get the default branch name for a repository
function getDefaultBranch(orgName: string, repo: string): string {
  // CAIPs uses main, others use master
  return orgName === "ChainAgnostic" ? "main" : "master";
}

/**
 * Get the file changes information from a PR
 */
async function getPRFileChanges(
  orgName: string,
  repo: string,
  prNumber: number
): Promise<any[]> {
  const apiUrl = `https://api.github.com/repos/${orgName}/${repo}/pulls/${prNumber}/files`;
  try {
    const response = await fetchWithRetry(apiUrl, { headers });
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch PR file changes: ${error}`);
    return [];
  }
}

/**
 * Get the EIP number from a PR by examining the locally cloned repository
 * or falling back to GitHub API if necessary
 */
async function getEIPNoFromPR(
  orgName: string,
  repo: string,
  prData: any,
  folderName: string,
  filePrefix: string,
  prNumber: number
): Promise<{ eipNo: string; githubUrl: string; rawGithubUrl: string } | null> {
  try {
    const repoPath = getRepoPath(orgName, repo);

    if (!fs.existsSync(repoPath)) {
      console.error(`Local repository not found at ${repoPath}`);
      return null;
    }

    // Try using local git operations first
    const { branchName, prData: fullPrData } = prData;
    const defaultBranch = getDefaultBranch(orgName, repo);

    let filesChanged: string[] = [];
    let localGitSucceeded = false;

    // First try with local git
    try {
      // Make sure we have the latest version of the repo
      execSync(`cd ${repoPath} && git fetch`, { stdio: "pipe" });

      // If the PR is from a fork, we need to add the remote repo
      const prAuthor = fullPrData.head.repo.owner.login;
      const isFromFork = prAuthor !== orgName;

      if (isFromFork) {
        const remoteName = `${prAuthor}-fork`;
        // Check if remote already exists
        const remotes = execSync(`cd ${repoPath} && git remote`, {
          encoding: "utf-8",
        }).split("\n");

        if (!remotes.includes(remoteName)) {
          execSync(
            `cd ${repoPath} && git remote add ${remoteName} https://github.com/${fullPrData.head.repo.full_name}.git`,
            { stdio: "pipe" }
          );
        }

        execSync(`cd ${repoPath} && git fetch ${remoteName} ${branchName}`, {
          stdio: "pipe",
        });

        // Get list of files changed
        const diffCommand = `cd ${repoPath} && git diff --name-status origin/${defaultBranch} ${remoteName}/${branchName}`;
        const diff = execSync(diffCommand, { encoding: "utf-8" });
        filesChanged = diff.split("\n");
      } else {
        // PR is from the same repo
        execSync(`cd ${repoPath} && git fetch origin ${branchName}`, {
          stdio: "pipe",
        });

        // Get list of files changed
        const diffCommand = `cd ${repoPath} && git diff --name-status origin/${defaultBranch} origin/${branchName}`;
        const diff = execSync(diffCommand, { encoding: "utf-8" });
        filesChanged = diff.split("\n");
      }

      localGitSucceeded = true;
    } catch (error) {
      console.warn(
        `Warning: Could not get changed files from local git for PR #${prNumber}: ${error}`
      );
      localGitSucceeded = false;
    }

    // If local git failed, use GitHub API
    if (!localGitSucceeded) {
      const prFiles = await getPRFileChanges(orgName, repo, prNumber);
      filesChanged = prFiles.map((file) => {
        const status =
          file.status === "added"
            ? "A"
            : file.status === "modified"
              ? "M"
              : file.status.charAt(0).toUpperCase();
        return `${status}\t${file.filename}`;
      });
    }

    // Look for added files (A) that match the pattern
    const regex = new RegExp(`^A\\s+${folderName}/${filePrefix}-(\\d+)\\.md$`);

    for (const file of filesChanged) {
      const match = file.match(regex);
      if (match && match[1]) {
        const eipNo = match[1];

        // GitHub URLs for the file
        const { repoOwnerAndName, branchName } = prData;
        const githubUrl = `https://github.com/${repoOwnerAndName}/blob/${branchName}/${folderName}/${filePrefix}-${eipNo}.md`;
        const rawGithubUrl = `https://raw.githubusercontent.com/${repoOwnerAndName}/refs/heads/${branchName}/${folderName}/${filePrefix}-${eipNo}.md`;

        return {
          eipNo,
          githubUrl,
          rawGithubUrl,
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`Failed to get EIP number from PR: ${error}`);
    return null;
  }
}

function extractEIPNumber(
  filePath: string,
  folderName: string,
  filePrefix: string
): string {
  // Remove the b/ prefix requirement and make it case insensitive
  const regex = new RegExp(`${folderName}/${filePrefix}-(\\d+)\\.md$`, "i");
  const match = filePath.match(regex);

  if (match && match[1]) {
    return match[1];
  } else {
    return "";
  }
}

/**
 * Fix GitHub URL to use raw.githubusercontent.com format
 */
function fixGitHubUrl(url: string): string {
  if (!url) return url;

  // If already a raw URL, return as is
  if (url.includes("raw.githubusercontent.com")) {
    return url;
  }

  // Convert GitHub blob URL to raw URL with refs/heads/
  // Example: https://github.com/user/repo/blob/branch/path/file.md -> https://raw.githubusercontent.com/user/repo/refs/heads/branch/path/file.md
  return url
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/refs/heads/");
}

/**
 * Determines if a cached entry is still valid based on timestamp
 */
function isCacheValid(cachedEntry: any): boolean {
  if (!cachedEntry || !cachedEntry.timestamp) return false;

  const now = Date.now();
  const cacheTime = new Date(cachedEntry.timestamp).getTime();
  const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);

  return hoursDiff < CACHE_FRESHNESS_HOURS;
}

/**
 * Get existing cached data for a PR
 */
function getCachedPRData(prNo: number, repo: string): any {
  let existingData: any = null;

  if (repo === "EIPs" || repo === "ERCs") {
    const match = Object.entries(existingEIPs).find(
      ([_, value]: [string, any]) => value.prNo === prNo
    );
    if (match) existingData = match[1];
  } else if (repo === "RIPs") {
    const match = Object.entries(existingRIPs).find(
      ([_, value]: [string, any]) => value.prNo === prNo
    );
    if (match) existingData = match[1];
  } else if (repo === "CAIPs") {
    const match = Object.entries(existingCAIPs).find(
      ([_, value]: [string, any]) => value.prNo === prNo
    );
    if (match) existingData = match[1];
  }

  return existingData;
}

/**
 * Process file changes to find relevant files and handle renames
 */
function processFileChanges(
  prFiles: any[],
  folderName: string,
  filePrefix: string
): {
  addedFiles: any[];
  renamedFiles: Array<{ oldFile: any; newFile: any }>;
} {
  const addedFiles: any[] = [];
  const renamedFiles: Array<{ oldFile: any; newFile: any }> = [];

  // First pass to collect renamed files
  const renameMap = new Map<string, any>();
  prFiles.forEach((file) => {
    if (file.status === "renamed") {
      renameMap.set(file.previous_filename, file);
    }
  });

  // Second pass to process files
  prFiles.forEach((file) => {
    const matchesPattern = (filename: string) =>
      filename.match(new RegExp(`${folderName}/${filePrefix}-\\d+\\.md$`, "i"));

    if (file.status === "added" && matchesPattern(file.filename)) {
      addedFiles.push(file);
    } else if (file.status === "renamed") {
      const oldMatches = matchesPattern(file.previous_filename);
      const newMatches = matchesPattern(file.filename);

      // Only process renames where at least one of the filenames matches our pattern
      if (oldMatches || newMatches) {
        renamedFiles.push({
          oldFile: {
            filename: file.previous_filename,
            status: "removed",
          },
          newFile: {
            filename: file.filename,
            status: "added",
          },
        });
      }
    }
  });

  return { addedFiles, renamedFiles };
}

const fetchDataFromOpenPRs = async ({
  orgName,
  repo,
  folderName,
  filePrefix,
  isERC,
}: {
  orgName: string;
  repo: string;
  folderName: string;
  filePrefix: string;
  isERC?: boolean;
}) => {
  const prNumbers = await getOpenPRNumbers(orgName, repo);
  const result: ValidEIPs = {};
  console.log(`Processing ${prNumbers.length} PRs for ${repo}...`);

  // Process PRs with improved concurrency
  await processWithConcurrency(
    prNumbers,
    async (prNo) => {
      try {
        // Check cache first
        const cachedData = getCachedPRData(prNo, repo);
        if (cachedData && isCacheValid(cachedData)) {
          console.log(
            `Using cached data for PR #${prNo} (${filePrefix}-${cachedData.number || "?"})`
          );
          result[cachedData.number || cachedData.id] = {
            ...cachedData,
            markdownPath: fixGitHubUrl(cachedData.markdownPath),
            timestamp: new Date().toISOString(),
          };
          return;
        }

        // Fetch PR data and file changes in parallel
        const [prData, prFiles] = await Promise.all([
          getPRData(orgName, prNo, repo),
          getPRFileChanges(orgName, repo, prNo),
        ]);

        if (!prData) {
          console.log(`No PR data found for PR #${prNo}`);
          return;
        }

        // Process file changes to find relevant files
        const { addedFiles, renamedFiles } = processFileChanges(
          prFiles,
          folderName,
          filePrefix
        );

        // Handle renamed files first to remove old data
        for (const { oldFile, newFile } of renamedFiles) {
          const oldEipNo = extractEIPNumber(
            oldFile.filename,
            folderName,
            filePrefix
          );
          const newEipNo = extractEIPNumber(
            newFile.filename,
            folderName,
            filePrefix
          );

          if (oldEipNo) {
            console.log(
              `Removing old data for ${filePrefix}-${oldEipNo} due to rename`
            );
            delete result[oldEipNo];
          }

          if (newEipNo) {
            // Process the new file as if it was added
            addedFiles.push(newFile);
          }
        }

        // Process added files (including renamed files with new EIP numbers)
        for (const addedFile of addedFiles) {
          const eipNo = extractEIPNumber(
            addedFile.filename,
            folderName,
            filePrefix
          );
          if (!eipNo) continue;

          // Construct GitHub URLs
          const { repoOwnerAndName, branchName } = prData;
          const rawGithubUrl = `https://raw.githubusercontent.com/${repoOwnerAndName}/refs/heads/${branchName}/${addedFile.filename}`;

          try {
            // Try local file first
            const repoPath = getRepoPath(orgName, repo);
            const localPath = path.join(repoPath, addedFile.filename);

            let eipMarkdown = "";
            let useLocalFile = false;

            try {
              if (fs.existsSync(localPath)) {
                eipMarkdown = fs.readFileSync(localPath, "utf-8");
                useLocalFile = true;
                console.log(`Using local file for ${filePrefix}-${eipNo}`);
              }
            } catch (error: any) {
              console.warn(
                `Could not read local file, will try GitHub API: ${error.message}`
              );
            }

            // Fallback to GitHub API if local file not available
            if (!useLocalFile) {
              console.log(
                `Fetching content from GitHub for ${filePrefix}-${eipNo} from ${rawGithubUrl}`
              );
              const eipMarkdownRes = await fetchWithRetry(rawGithubUrl, {
                headers,
              });
              eipMarkdown = eipMarkdownRes.data;
            }

            const { metadata } = extractMetadata(eipMarkdown);
            const { title, status, requires } = convertMetadataToJson(metadata);

            console.log(`Found WIP ${filePrefix}: ${eipNo}: ${title}`);

            result[eipNo] = {
              title: title || `${filePrefix.toUpperCase()}-${eipNo}`,
              status,
              isERC,
              prNo,
              markdownPath: rawGithubUrl,
              requires,
              timestamp: new Date().toISOString(),
            };

            console.log(`Successfully added ${filePrefix}-${eipNo} to result`);
          } catch (error: any) {
            console.warn(
              `⚠️ Could not read content for ${filePrefix}-${eipNo} from PR #${prNo}: ${error.message}`
            );
          }
        }
      } catch (error: any) {
        console.warn(`⚠️ Error processing PR #${prNo}: ${error.message}`);
      }
    },
    MAX_CONCURRENT_REQUESTS
  );

  console.log(
    `Finished processing ${repo}. Found ${Object.keys(result).length} valid entries.`
  );
  return result;
};

const updateEIPData = async () => {
  console.log("Updating EIP data...");
  const resOpenEIPs = await fetchDataFromOpenPRs({
    orgName: "ethereum",
    repo: "EIPs",
    folderName: "EIPS",
    filePrefix: "eip",
  });
  console.log("Updating ERC data...");
  const resOpenERCs = await fetchDataFromOpenPRs({
    orgName: "ethereum",
    repo: "ERCs",
    folderName: "ERCS",
    filePrefix: "erc",
    isERC: true,
  });
  const result = { ...resOpenEIPs, ...resOpenERCs };

  updateFileData(result, "valid-eips.json");
  console.log("EIP/ERC data updated successfully!");
};

const updateRIPData = async () => {
  console.log("Updating RIP data...");
  const resOpenRIPs = await fetchDataFromOpenPRs({
    orgName: "ethereum",
    repo: "RIPs",
    folderName: "RIPS",
    filePrefix: "rip",
  });

  updateFileData(resOpenRIPs, "valid-rips.json");
  console.log("RIP data updated successfully!");
};

const updateCAIPData = async () => {
  console.log("Updating CAIP data...");
  const resOpenCAIPs = await fetchDataFromOpenPRs({
    orgName: "ChainAgnostic",
    repo: "CAIPs",
    folderName: "CAIPs",
    filePrefix: "caip",
  });

  updateFileData(resOpenCAIPs, "valid-caips.json");
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

// Execute main function
main();
