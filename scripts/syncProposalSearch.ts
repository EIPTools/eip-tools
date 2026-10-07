import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import type { ValidEIPs } from "../types";
import { githubSource, isProposalMarkdown, resolveProposalSource, fetchRemoteMarkdown, type ProposalKind } from "../utils/proposalContent";
import { proposalSearchDocuments, proposalSearchSettings, type ProposalSearchDocument } from "../utils/proposalSearch";
import { verifyIndexSwap } from "../utils/meilisearchTasks";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Search credentials live separately from the app's production environment.
config({ path: path.join(root, ".env.meilisearch.local") });
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const allowPartial = args.has("--allow-partial");
const host = process.env.MEILISEARCH_HOST?.replace(/\/$/, "");
const key = process.env.MEILISEARCH_INDEXING_KEY;
const index = process.env.MEILISEARCH_INDEX || "proposal_sections";
if (!dryRun && (!host || !key)) throw new Error("Set MEILISEARCH_HOST and MEILISEARCH_INDEXING_KEY (see docs/SEARCH.md)");
if (!/^[a-zA-Z0-9_-]+$/.test(index)) throw new Error("Invalid search index name");

async function meili(endpoint: string, method = "GET", body?: unknown): Promise<any> {
  const response = await fetch(`${host}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Meilisearch ${method} ${endpoint}: ${response.status} ${result.code || "request_failed"}`);
  return result;
}

async function waitTask(task: { taskUid: number }) {
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const state = await meili(`/tasks/${task.taskUid}`);
    if (state.status === "succeeded") return;
    if (["failed", "canceled"].includes(state.status)) throw new Error(`Task ${task.taskUid}: ${state.error?.message || state.status}`);
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  throw new Error(`Task ${task.taskUid} timed out; live index was not replaced`);
}

const sources: Array<{ kind: ProposalKind; filename: string }> = [
  { kind: "eip", filename: "valid-eips.json" },
  { kind: "rip", filename: "valid-rips.json" },
  { kind: "caip", filename: "valid-caips.json" },
];
async function main() {
  const jobs: Array<{ kind: ProposalKind; number: string; proposal: ValidEIPs[string] }> = [];
  const identities = new Set<string>();
  for (const source of sources) {
    const proposals: ValidEIPs = JSON.parse(await fs.readFile(path.join(root, "data", source.filename), "utf8"));
    for (const [number, proposal] of Object.entries(proposals)) {
      // Use the reader's numeric keys, including padded identities, rather than
      // guessing identities from a PR's filenames.
      if (!/^\d+$/.test(number)) continue;
      const canonical = number.replace(/^0+(?=\d)/, "");
      const identity = `${source.kind}-${canonical}`;
      if (identities.has(identity)) continue;
      identities.add(identity);
      jobs.push({ kind: source.kind, number: canonical, proposal });
    }
  }

  const githubFetch: typeof fetch = (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    if (process.env.GITHUB_TOKEN && new URL(url).hostname === "api.github.com") headers.set("Authorization", `Bearer ${process.env.GITHUB_TOKEN}`);
    return fetch(input, { ...init, headers });
  };

  const documents: ProposalSearchDocument[] = [];
  const failures: Array<{ proposalId: string; sourceUrl: string; error: string }> = [];
  let cursor = 0, completed = 0, indexed = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const { kind, number, proposal } = jobs[cursor++];
      const type = kind === "eip" ? proposal.isERC ? "ERC" : "EIP" : kind.toUpperCase() as "RIP" | "CAIP";
      const proposalId = `${type.toLowerCase()}-${number}`;
      let sourceUrl = proposal.markdownPath;
      try {
        let markdown: string;
        let prState = proposal.prState || "official";
        if (proposal.prNo) {
          const resolved = await resolveProposalSource(kind, proposal, githubFetch);
          prState = resolved.prState || "open";
          sourceUrl = resolved.markdownPath;
          markdown = await fetchRemoteMarkdown(sourceUrl, githubFetch);
        } else {
          const source = githubSource(sourceUrl);
          const expectedRepo = kind === "eip" ? proposal.isERC ? "ERCs" : "EIPs" : kind === "rip" ? "RIPs" : "CAIPs";
          if (source.repo !== expectedRepo || source.owner !== (kind === "caip" ? "ChainAgnostic" : "ethereum")) throw new Error("Unexpected canonical source");
          try {
            markdown = await fs.readFile(path.join(root, "submodules", source.repo, source.file), "utf8");
          } catch {
            markdown = await fetchRemoteMarkdown(sourceUrl, githubFetch);
          }
        }
        if (!isProposalMarkdown(markdown, sourceUrl, number)) throw new Error("Source does not match reader identity or contains no proposal text");
        const status = markdown.match(/^status:\s*(.+)$/m)?.[1].trim() || proposal.status || "Draft";
        const title = markdown.match(/^title:\s*(.+)$/m)?.[1].trim() || proposal.title;
        const sections = proposalSearchDocuments({
          proposalId, label: `${type}-${number}`, title, type, status,
          prState, url: `/${kind}/${number}`, sourceUrl,
        }, markdown);
        if (!sections.length) throw new Error("No searchable proposal content");
        documents.push(...sections);
        indexed++;
      } catch (error) {
        failures.push({ proposalId, sourceUrl, error: error instanceof Error ? error.message : String(error) });
      }
      completed++;
      if (completed % 200 === 0 || completed === jobs.length) console.log(`Read ${completed}/${jobs.length} proposals; ${failures.length} unavailable`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  documents.sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(documents.map(document => document.id)).size !== documents.length) throw new Error("Duplicate section IDs");
  // During explicitly permitted partial refreshes, preserve the last successful
  // text for failing sources. Never retain documents for removed reader identities.
  let retainedProposals = 0;
  if (!dryRun && allowPartial && failures.length) {
    const failedIds = new Set(failures.map(failure => failure.proposalId));
    const filter = encodeURIComponent(`proposalId IN [${Array.from(failedIds).map(id => JSON.stringify(id)).join(",")}]`);
    const retained = new Set<string>();
    try {
      for (let offset = 0; ; offset += 1000) {
        const page = await meili(`/indexes/${index}/documents?limit=1000&offset=${offset}&filter=${filter}`);
        for (const document of page.results as ProposalSearchDocument[]) {
          if (failedIds.has(document.proposalId)) { documents.push(document); retained.add(document.proposalId); }
        }
        if (offset + page.results.length >= page.total) break;
      }
      retainedProposals = retained.size;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("index_not_found")) throw error;
    }
  }
  const report = { generatedAt: new Date().toISOString(), expectedProposals: jobs.length, indexedProposals: indexed, retainedProposals, omittedProposals: failures.length - retainedProposals, sections: documents.length, failures };
  await fs.mkdir(path.join(root, ".search"), { recursive: true });
  await fs.writeFile(path.join(root, ".search", "coverage.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, failures: failures.length }));
  if (!documents.length) throw new Error("No documents collected; refusing to replace search index");
  if (failures.length && !allowPartial) throw new Error("Incomplete source coverage; live index unchanged. See .search/coverage.json. Use --allow-partial only after reviewing omissions.");
  if (dryRun) process.exit(0);

  // Build off to the side, including settings, before changing the live index.
  // Index swaps also remove documents deleted from the upstream corpus.
  const staging = `${index}_staging_${Date.now()}`;
  await waitTask(await meili("/indexes", "POST", { uid: staging, primaryKey: "id" }));
  try {
    await waitTask(await meili(`/indexes/${staging}/settings`, "PATCH", proposalSearchSettings));
    const batchSize = 1000;
    for (let offset = 0; offset < documents.length; offset += batchSize) {
      await waitTask(await meili(`/indexes/${staging}/documents`, "POST", documents.slice(offset, offset + batchSize)));
      console.log(`Uploaded ${Math.min(offset + batchSize, documents.length)}/${documents.length} sections`);
    }
    const stats = await meili(`/indexes/${staging}/stats`);
    if (stats.numberOfDocuments !== documents.length) throw new Error("Staging document count mismatch");
    const stagingMetadata = await meili(`/indexes/${staging}`);
    try { await meili(`/indexes/${index}`); }
    catch (error) {
      if (!(error instanceof Error) || !error.message.includes("index_not_found")) throw error;
      await waitTask(await meili("/indexes", "POST", { uid: index, primaryKey: "id" }));
    }
    const swap = await meili("/swap-indexes", "POST", [{ indexes: [index, staging] }]);
    await verifyIndexSwap(() => waitTask(swap), () => meili(`/indexes/${index}`), stagingMetadata.createdAt);
    console.log(`Search index ${index} is live: ${indexed + retainedProposals} proposals, ${documents.length} sections`);
  } finally {
    try { await waitTask(await meili(`/indexes/${staging}`, "DELETE")); }
    catch (error) { console.error(`Could not remove staging index ${staging}: ${error instanceof Error ? error.message : String(error)}`); }
  }

}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
