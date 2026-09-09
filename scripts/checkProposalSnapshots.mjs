import { readdir } from "node:fs/promises";

// Fail at build time rather than silently deploying without outage fallbacks.
for (const directory of [
  "submodules/EIPs/EIPS",
  "submodules/ERCs/ERCS",
  "submodules/RIPs/RIPS",
  "submodules/CAIPs/CAIPs",
]) {
  const files = await readdir(directory).catch(() => []);
  if (!files.some((file) => file.endsWith(".md"))) {
    throw new Error(`Missing proposal snapshots in ${directory}. Run git submodule update --init --recursive before building.`);
  }
}
