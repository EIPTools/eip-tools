import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { validEIPs } from "../data/validEIPs";
import { getProposalDetails } from "../utils/proposals";
import { readBundledMarkdown } from "../utils/proposalContent.server";
import { getCanonicalProposalHref } from "../utils/proposalLinks";

test("normalized IDs resolve the exact zero-padded proposal source", async () => {
  const proposal = getProposalDetails(validEIPs, "10101");
  assert.ok(proposal, "10101 must resolve the indexed 010101 proposal");
  assert.equal(proposal, validEIPs["010101"]);
  assert.match(proposal.markdownPath, /eip-010101\.md$/);
  // This entry is a fork/PR, not bundled: do not replace it with another source.
  await assert.rejects(readBundledMarkdown(proposal.markdownPath), /No matching bundled source/);
});

const responseFor = (path: string) => middleware(new NextRequest(`https://eip.tools${path}`));

test("padded reader aliases normalize to the same numeric URL as markdown links", () => {
  for (const path of ["/eip/04200", "/eip/eip-04200.md", "/eip/010101", "/eip/eip-010101.md"]) {
    const target = path.includes("4200") ? "/eip/4200" : "/eip/10101";
    assert.equal(responseFor(path).status, 308, path);
    assert.equal(responseFor(path).headers.get("location"), `https://eip.tools${target}`);
    assert.equal(getCanonicalProposalHref(`${path}#abstract`), `${target}#abstract`);
  }
});

test("bare-number shortcuts are permanent and preserve queries", () => {
  const response = responseFor("/4200?source=search");
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://eip.tools/eip/4200?source=search");
});

test("canonical readers, invalid proposals and unrelated paths are not redirected", () => {
  for (const path of ["/eip/4200", "/eip/10101", "/rip/7560", "/caip/2", "/api/proposals/eip/4200", "/assets/eip-4200.md", "/eip/rip-7560.md", "/rip/eip-4200", "/caip/erc-20", "/eip/eip-999999999999.md", "/eip/eip-4200.md/extra", "/eip/eip--4200", "/eip/eip-4200.md.bak"]) {
    assert.equal(responseFor(path).headers.get("location"), null, path);
  }
});

test("known filename routes permanently redirect to numeric readers preserving URL suffixes", () => {
  for (const [from, to] of [
    ["/eip/eip-4200.md", "/eip/4200"],
    ["/eip/eip-4200", "/eip/4200"],
    ["/eip/erc-20.md", "/eip/20"],
    ["/rip/rip-7560.md", "/rip/7560"],
    ["/caip/caip-2", "/caip/2"],
  ]) {
    const response = responseFor(`${from}?source=test#abstract`);
    assert.equal(response.status, 308, from);
    assert.equal(response.headers.get("location"), `https://eip.tools${to}?source=test#abstract`);
  }
});
