import * as fs from "fs";
import * as path from "path";
import { ValidEIPs, GraphData } from "@/types";
import { validEIPs } from "@/data/validEIPs";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateGraphData(validEIPs: ValidEIPs): Promise<void> {
  console.log("\nGenerating EIP dependency graph...");
  console.log(`Processing ${Object.keys(validEIPs).length} EIPs\n`);

  const graphData: GraphData = {
    nodes: [],
    links: [],
  };

  const processedEIPs = new Set<string>();

  // Helper function to add a node if it doesn't exist
  const addNode = (eipNo: string, eipData: ValidEIPs[string]) => {
    const id = `eip-${eipNo}`;
    if (!processedEIPs.has(eipNo)) {
      graphData.nodes.push({
        id,
        eipNo,
        title: eipData.title || `EIP-${eipNo}`,
        status: eipData.status || "Draft",
        isERC: eipData.isERC || false,
      });
      processedEIPs.add(eipNo);
      console.log(
        `Added node: EIP-${eipNo} (${eipData.title || `EIP-${eipNo}`})`
      );
    }
  };

  // Process each EIP
  for (const [eipNo, eipData] of Object.entries(validEIPs)) {
    try {
      console.log(`\nProcessing EIP-${eipNo}...`);

      // Add the current EIP as a node
      addNode(eipNo, eipData);

      // Process requirements if they exist
      if (eipData.requires && Array.isArray(eipData.requires)) {
        console.log(
          `- Processing ${eipData.requires.length} dependencies for EIP-${eipNo}`
        );

        for (const requiredEip of eipData.requires) {
          // Only add links for EIPs that exist in validEIPs
          if (validEIPs[requiredEip]) {
            console.log(`  - Loading dependency: EIP-${requiredEip}`);

            // Add required EIP as node
            addNode(requiredEip, validEIPs[requiredEip]);

            // Add link
            graphData.links.push({
              source: `eip-${eipNo}`,
              target: `eip-${requiredEip}`,
            });
            console.log(
              `  - Added dependency link: EIP-${eipNo} -> EIP-${requiredEip}`
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

// Example usage
generateGraphData(validEIPs);
