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
const MAX_CONCURRENT_REQUESTS = 5;
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

async function fetchWithRetry(
  url: string,
  options: any,
  retries = MAX_RETRIES
): Promise<any> {
  try {
    return await axios.get(url, options);
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retrying... (${MAX_RETRIES - retries + 1})`);
      await new Promise((res) =>
        setTimeout(res, 1000 * (MAX_RETRIES - retries + 1))
      ); // Exponential backoff
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
        const rawGithubUrl = `https://raw.githubusercontent.com/${repoOwnerAndName}/${branchName}/${folderName}/${filePrefix}-${eipNo}.md`;

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
  const regex = new RegExp(`b/${folderName}/${filePrefix}-(\\d+)\\.md`);
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

  // Convert GitHub blob URL to raw URL
  // Example: https://github.com/user/repo/blob/branch/path/file.md -> https://raw.githubusercontent.com/user/repo/branch/path/file.md
  return url
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/");
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

        if (!prData) return;

        // Process file changes to find EIP file
        const addedFiles = prFiles.filter(
          (file: any) =>
            file.status === "added" &&
            file.filename.match(
              new RegExp(`${folderName}/${filePrefix}-\\d+\\.md$`)
            )
        );

        if (addedFiles.length === 0) return;

        const addedFile = addedFiles[0];
        const eipNo = extractEIPNumber(
          addedFile.filename,
          folderName,
          filePrefix
        );
        if (!eipNo) return;

        // Construct GitHub URLs
        const { repoOwnerAndName, branchName } = prData;
        const rawGithubUrl = `https://raw.githubusercontent.com/${repoOwnerAndName}/${branchName}/${addedFile.filename}`;

        try {
          // Try local file first
          const repoPath = getRepoPath(orgName, repo);
          const localPath = path.join(
            repoPath,
            folderName,
            `${filePrefix}-${eipNo}.md`
          );

          let eipMarkdown = "";
          let useLocalFile = false;

          try {
            if (fs.existsSync(localPath)) {
              eipMarkdown = fs.readFileSync(localPath, "utf-8");
              useLocalFile = true;
            }
          } catch (error: any) {
            console.warn(
              `Could not read local file, will try GitHub API: ${error.message}`
            );
          }

          // Fallback to GitHub API if local file not available
          if (!useLocalFile) {
            console.log(
              `Fetching content from GitHub for ${filePrefix}-${eipNo}`
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
        } catch (error: any) {
          console.warn(
            `⚠️ Could not read content for ${filePrefix}-${eipNo} from PR #${prNo}: ${error.message}`
          );
        }
      } catch (error: any) {
        console.warn(`⚠️ Error processing PR #${prNo}: ${error.message}`);
      }
    },
    MAX_CONCURRENT_REQUESTS
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
