import { ValidEIPs } from "@/types";
import { convertMetadataToJson, extractMetadata } from "@/utils";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eipDir = path.join(__dirname, "../submodules/EIPs/EIPS");
const ercDir = path.join(__dirname, "../submodules/ERCs/ERCS");
const ripDir = path.join(__dirname, "../submodules/RIPs/RIPS");
const caipDir = path.join(__dirname, "../submodules/CAIPs/CAIPs");

const listFiles = (dir: string, filePrefix: string): number[] => {
  const files = fs.readdirSync(dir);
  const numbers: number[] = [];

  files.forEach((file) => {
    const match = file.match(new RegExp(`^${filePrefix}-(\\d+)\\.md$`));
    if (match) {
      numbers.push(parseInt(match[1], 10));
    }
  });

  return numbers;
};

const getEIPMetadata = (
  dir: string,
  prefix: string,
  number: number
): {
  title: string;
  status: string;
  requires: number[];
} => {
  const filePath = path.join(dir, `${prefix}-${number}.md`);
  const content = fs.readFileSync(filePath, "utf-8");

  const { metadata } = extractMetadata(content);
  const { title, status, requires } = convertMetadataToJson(metadata);

  return {
    title,
    status,
    requires,
  };
};

export const updateFileData = async (result: ValidEIPs, fileName: string) => {
  let currentData = "{}";

  // check if file exists
  if (fs.existsSync(path.join(__dirname, `../data/${fileName}`))) {
    currentData = await fs.promises.readFile(
      path.join(__dirname, `../data/${fileName}`),
      "utf-8"
    );
  }
  const currentDataJSON = JSON.parse(currentData);

  const updatedData = { ...currentDataJSON, ...result };

  await fs.promises.writeFile(
    path.join(__dirname, `../data/${fileName}`),
    JSON.stringify(updatedData, null, 2)
  );

  console.log(`${fileName} updated successfully!`);
};

const updateEIPData = async () => {
  const eipNumbers = listFiles(eipDir, "eip");
  const ercNumbers = listFiles(ercDir, "erc");

  const combinedEIPNumbers = [...eipNumbers, ...ercNumbers].sort(
    (a, b) => a - b
  );

  const result: ValidEIPs = {};

  combinedEIPNumbers.forEach((number) => {
    // checking ERC first because duplicates in EIP folder (but without content)
    if (ercNumbers.includes(number)) {
      result[number] = {
        ...getEIPMetadata(ercDir, "erc", number),
        isERC: true,
        markdownPath: `https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-${number}.md`,
      };
    } else if (eipNumbers.includes(number)) {
      result[number] = {
        ...getEIPMetadata(eipDir, "eip", number),
        isERC: false,
        markdownPath: `https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-${number}.md`,
      };
    }
  });

  await updateFileData(result, "valid-eips.json");
};

const updateRIPData = async () => {
  const ripNumbers = listFiles(ripDir, "rip");

  const result: ValidEIPs = {};

  ripNumbers.forEach((number) => {
    result[number] = {
      ...getEIPMetadata(ripDir, "rip", number),
      markdownPath: `https://raw.githubusercontent.com/ethereum/RIPs/master/RIPS/rip-${number}.md`,
    };
  });

  await updateFileData(result, "valid-rips.json");
};

const updateCAIPData = async () => {
  const caipNumbers = listFiles(caipDir, "caip");

  const result: ValidEIPs = {};

  caipNumbers.forEach((number) => {
    result[number] = {
      ...getEIPMetadata(caipDir, "caip", number),
      markdownPath: `https://raw.githubusercontent.com/ChainAgnostic/CAIPs/main/CAIPs/caip-${number}.md`,
    };
  });

  await updateFileData(result, "valid-caips.json");
};

const main = async () => {
  updateEIPData();
  updateRIPData();
  updateCAIPData();
};

main();
