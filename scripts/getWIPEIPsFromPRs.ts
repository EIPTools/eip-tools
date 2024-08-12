import { updateFileData } from "./fetchValidEIPs";
async function getOpenPRNumbers(
  orgName: string,
  repo: string
): Promise<Array<number>> {
  console.log(`Fetching open PRs for ${orgName}/${repo}...`);
    const apiUrl = `https://api.github.com/repos/${orgName}/${repo}/pulls?state=open`;
async function getPRData(orgName: string, prNumber: number, repo: string) {
  const apiUrl = `https://api.github.com/repos/${orgName}/${repo}/pulls/${prNumber}`;
async function getEIPNoFromDiff(
  diffUrl: string,
  folderName: string,
  filePrefix: string
) {
        if (filePath.includes(`${folderName}/`)) {
          eipNumber = extractEIPNumber(filePath, folderName, filePrefix);
function extractEIPNumber(
  filePath: string,
  folderName: string,
  filePrefix: string
) {
  const regex = new RegExp(`b/${folderName}/${filePrefix}-(\\d+)\\.md`);
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
  // future: _.chunk incase gh rate limits
  await Promise.all(
    prNumbers.map(async (prNo) => {
      const prData = await getPRData(orgName, prNo, repo);
      if (!prData) return;
      const { diffUrl, repoOwnerAndName, branchName } = prData;
      const eipNo = await getEIPNoFromDiff(diffUrl, folderName, filePrefix);

      if (eipNo > 0) {
        const markdownPath = `https://raw.githubusercontent.com/${repoOwnerAndName}/${branchName}/${folderName}/${filePrefix}-${eipNo}.md`;
        const eipMarkdownRes: string = (await axios.get(markdownPath)).data;
        const { metadata } = extractMetadata(eipMarkdownRes);
        const { title, status } = convertMetadataToJson(metadata);

        console.log(`Found WIP ${filePrefix}: ${eipNo}: ${title}`);

        result[eipNo] = {
          title,
          status,
          isERC,
          prNo,
          markdownPath,
        };
      }
    })
  );
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