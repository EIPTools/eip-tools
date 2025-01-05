import * as fs from "fs";
import * as path from "path";
import { ValidEIPs, EipMetadataJson, GraphData } from "@/types";
import { convertMetadataToJson } from "@/utils";
import { validEIPs } from "@/data/validEIPs";

import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eipDir = path.join(__dirname, "../submodules/EIPs/EIPS");
const ercDir = path.join(__dirname, "../submodules/ERCs/ERCS");

async function generateGraphData(
  validEIPs: ValidEIPs,
  convertMetadataToJson: (metadataText: string) => EipMetadataJson
): Promise<void> {
  console.log("\nGenerating EIP dependency graph...");
  console.log(`Processing ${Object.keys(validEIPs).length} EIPs\n`);

  const graphData: GraphData = {
    nodes: [],
    links: [],
  };

  const processedEIPs = new Set<number>();

  // Helper function to add a node if it doesn't exist
  const addNode = (metadata: EipMetadataJson, eipData: ValidEIPs[number]) => {
    const id = `eip-${metadata.eip}`;
    if (!processedEIPs.has(metadata.eip)) {
      graphData.nodes.push({
        id,
        eipNo: metadata.eip,
        title: metadata.title,
        status: metadata.status,
        type: metadata.type,
        category: metadata.category,
        isERC: eipData.isERC,
      });
      processedEIPs.add(metadata.eip);
      console.log(`Added node: EIP-${metadata.eip} (${metadata.title})`);
    }
  };

  // Process each EIP
  for (const [eipNo, eipData] of Object.entries(validEIPs)) {
    try {
      console.log(`\nProcessing EIP-${eipNo}...`);

      // Read the markdown file
      const markdownContent = await readMarkdown(eipData, eipNo);
      console.log(`- Loaded markdown for EIP-${eipNo}`);

      // Convert to metadata JSON
      const metadata = convertMetadataToJson(markdownContent);
      console.log(`- Extracted metadata for EIP-${eipNo}`);

      // Add the current EIP as a node
      addNode(metadata, eipData);

      // Process requirements if they exist
      if (metadata.requires && Array.isArray(metadata.requires)) {
        console.log(
          `- Processing ${metadata.requires.length} dependencies for EIP-${eipNo}`
        );

        for (const requiredEip of metadata.requires) {
          // Only add links for EIPs that exist in validEIPs
          if (validEIPs[requiredEip]) {
            console.log(`  - Loading dependency: EIP-${requiredEip}`);
            const requiredMarkdown = await readMarkdown(
              validEIPs[requiredEip],
              requiredEip
            );
            const requiredMetadata = convertMetadataToJson(requiredMarkdown);

            // Add required EIP as node
            addNode(requiredMetadata, validEIPs[requiredEip]);

            // Add link
            graphData.links.push({
              source: `eip-${metadata.eip}`,
              target: `eip-${requiredEip}`,
            });
            console.log(
              `  - Added dependency link: EIP-${metadata.eip} -> EIP-${requiredEip}`
            );
          } else {
            console.log(
              `  - Skipping invalid dependency: EIP-${requiredEip} (not in validEIPs)`
            );
          }
        }
      } else {
        console.log(`- No dependencies found for EIP-${eipNo}`);
      }
    } catch (error) {
      console.error(`\nError processing EIP-${eipNo}:`, error);
    }
  }

  // Write the graph data to a JSON file
  const outputPath = path.resolve(__dirname, "../data/eip-graph-data.json");
  await fs.promises.writeFile(outputPath, JSON.stringify(graphData, null, 2));

  console.log(`\nGraph generation complete!`);
  console.log(`- Nodes created: ${graphData.nodes.length}`);
  console.log(`- Links created: ${graphData.links.length}`);
  console.log(`- Output written to: ${outputPath}\n`);
}

const readMarkdown = async (
  eipData: ValidEIPs[number],
  eipNo: string | number
): Promise<string> => {
  let markdownContent: string = "";
  if (eipData.prNo) {
    // Fetch remote markdown content using axios
    const response = await axios.get(eipData.markdownPath);
    markdownContent = response.data;
  } else {
    if (eipData.isERC) {
      markdownContent = await fs.promises.readFile(
        path.resolve(ercDir, `erc-${eipNo}.md`),
        "utf-8"
      );
    } else {
      markdownContent = await fs.promises.readFile(
        path.resolve(eipDir, `eip-${eipNo}.md`),
        "utf-8"
      );
    }
  }
  return markdownContent;
};

// Example usage
generateGraphData(validEIPs, convertMetadataToJson);
