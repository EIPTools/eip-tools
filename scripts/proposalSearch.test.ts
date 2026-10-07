import assert from "node:assert/strict";
import { test } from "node:test";
import { proposalSearchDocuments, type SearchProposal } from "../utils/proposalSearch";
import { extractMarkdownHeadings } from "../utils/markdownHeadings";
import { verifyIndexSwap } from "../utils/meilisearchTasks";

const proposal: SearchProposal = {
  proposalId: "eip-1559", label: "EIP-1559", title: "Fee market",
  type: "EIP", status: "Final", url: "/eip/1559", sourceUrl: "https://example.test/source",
};

test("search preserves all section text and uses reader anchors, including repeated headings", () => {
  const body = "Introduction\n\n## **Specification**\n\n`chainId` and `DELEGATECALL`\n\n```solidity\n## not a heading\nmapping(address => uint256) token_balances;\n```\n\n## Specification\n\n0x1234\n";
  const markdown = "---\neip: 1559\ntitle: Fee market\n---\n" + body;
  const docs = proposalSearchDocuments(proposal, markdown);
  assert.equal(docs.length, 3);
  assert.equal(docs[0].url, "/eip/1559");
  assert.deepEqual(docs.slice(1).map(doc => doc.url), extractMarkdownHeadings(body).map(heading => `/eip/1559#${heading.id}`));
  assert.equal(docs[2].url, "/eip/1559#specification-1");
  assert.ok(docs[1].body.includes("token_balances"));
  assert.ok(docs[1].body.includes("mapping(address => uint256)"));
  assert.ok(docs[1].body.includes("## not a heading"));
  assert.ok(docs[2].body.includes("0x1234"));
  assert.ok(!docs.some(doc => doc.body.includes("eip: 1559")));
});

test("large sections retain all content and link every part to the same section", () => {
  const text = "## Specification\n\n" + "content ".repeat(10000);
  const docs = proposalSearchDocuments(proposal, text);
  assert.ok(docs.length > 1);
  assert.equal(docs.map(doc => doc.body).join(""), text.trim());
  assert.ok(docs.every(doc => doc.url === "/eip/1559#specification"));
  assert.equal(new Set(docs.map(doc => doc.id)).size, docs.length);
});

test("proposal types with the same number have distinct section identities", () => {
  const eip = proposalSearchDocuments(proposal, "## Abstract\nText");
  const caip = proposalSearchDocuments({ ...proposal, proposalId: "caip-1559", type: "CAIP", url: "/caip/1559" }, "## Abstract\nText");
  assert.notEqual(eip[0].id, caip[0].id);
  assert.equal(caip[0].url, "/caip/1559#abstract");
});

test("index-scoped keys can confirm a hidden swap task only after the exact build is live", async () => {
  const hiddenTask = async () => { throw new Error("Meilisearch GET /tasks/148: 404 task_not_found"); };
  await verifyIndexSwap(hiddenTask, async () => ({ createdAt: "new-build" }), "new-build", 0);
  await assert.rejects(verifyIndexSwap(hiddenTask, async () => ({ createdAt: "old-build" }), "new-build", 0), /Could not verify/);
  await assert.rejects(verifyIndexSwap(hiddenTask, async () => ({ createdAt: "new-build" }), "", 0), /Missing staging/);
});

test("a failed swap task cannot be disguised as an unavailable task", async () => {
  let inspected = false;
  await assert.rejects(verifyIndexSwap(
    async () => { throw new Error("Task 148: failed"); },
    async () => { inspected = true; return { createdAt: "new-build" }; },
    "new-build",
  ), /Task 148: failed/);
  assert.equal(inspected, false);
});
