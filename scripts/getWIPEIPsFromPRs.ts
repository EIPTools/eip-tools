import { config } from "dotenv";
config({ path: ".env.local" });

import axios from "axios";
import { convertMetadataToJson, extractMetadata } from "@/utils";
import { ValidEIPs } from "@/types";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { updateFileData } from "./fetchValidEIPs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const headers = {
  Authorization: `token ${process.env.GITHUB_TOKEN}`,
};

const MAX_RETRIES = 5;

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

    const diffUrl = prData.diff_url;
    const repoOwnerAndName = prData.head.repo.full_name;
    const branchName = prData.head.ref;
    return { diffUrl, repoOwnerAndName, branchName };
  } catch (error) {
    console.error(`Failed to fetch PR details: ${error}`);
  }
}

async function getEIPNoFromDiff(
  diffUrl: string,
  folderName: string,
  filePrefix: string
) {
  try {
    const response = await fetchWithRetry(diffUrl, {});
    const diffContent = response.data;

    const lines = diffContent.split("\n");

    let eipNumber: number = 0;

    lines.forEach((line: string, index: number) => {
      if (line.startsWith("new file mode")) {
        const filePathLine = lines[index + 3];
        const filePath = filePathLine.split(" ")[1];

        if (!filePath) return;

        if (filePath.includes(`${folderName}/`)) {
          eipNumber = extractEIPNumber(filePath, folderName, filePrefix);
        }
      }
    });

    return eipNumber;
  } catch (error) {
    console.error(`Failed to fetch or parse diff: ${error}`);
    return 0;
  }
}

function extractEIPNumber(
  filePath: string,
  folderName: string,
  filePrefix: string
) {
  const regex = new RegExp(`b/${folderName}/${filePrefix}-(\\d+)\\.md`);
  const match = filePath.match(regex);

  if (match && match[1]) {
    return parseInt(match[1]);
  } else {
    return 0;
  }
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

  await Promise.all(
    prNumbers.map(async (prNo) => {
      const prData = await getPRData(orgName, prNo, repo);
      if (!prData) return;
      const { diffUrl, repoOwnerAndName, branchName } = prData;
      const eipNo = await getEIPNoFromDiff(diffUrl, folderName, filePrefix);

      if (eipNo > 0) {
        const markdownPath = `https://raw.githubusercontent.com/${repoOwnerAndName}/${branchName}/${folderName}/${filePrefix}-${eipNo}.md`;
        const eipMarkdownRes: string = (await fetchWithRetry(markdownPath, {}))
          .data;
        const { metadata } = extractMetadata(eipMarkdownRes);
        const { title, status, requires } = convertMetadataToJson(metadata);

        console.log(`Found WIP ${filePrefix}: ${eipNo}: ${title}`);

        result[eipNo] = {
          title,
          status,
          isERC,
          prNo,
          markdownPath,
          requires,
        };
      }
    })
  );

  return result;
};

const updateEIPData = async () => {
  const resOpenEIPs = await fetchDataFromOpenPRs({
    orgName: "ethereum",
    repo: "EIPs",
    folderName: "EIPS",
    filePrefix: "eip",
  });
  const resOpenERCs = await fetchDataFromOpenPRs({
    orgName: "ethereum",
    repo: "ERCs",
    folderName: "ERCS",
    filePrefix: "erc",
    isERC: true,
  });
  const result = { ...resOpenEIPs, ...resOpenERCs };

  updateFileData(result, "valid-eips.json");
};

const updateRIPData = async () => {
  const resOpenRIPs = await fetchDataFromOpenPRs({
    orgName: "ethereum",
    repo: "RIPs",
    folderName: "RIPS",
    filePrefix: "rip",
  });

  updateFileData(resOpenRIPs, "valid-rips.json");
};

const updateCAIPData = async () => {
  const resOpenCAIPs = await fetchDataFromOpenPRs({
    orgName: "ChainAgnostic",
    repo: "CAIPs",
    folderName: "CAIPs",
    filePrefix: "caip",
  });

  updateFileData(resOpenCAIPs, "valid-caips.json");
};

const main = async () => {
  updateEIPData();
  updateRIPData();
  updateCAIPData();
};

main();
