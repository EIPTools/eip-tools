import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchRemoteMarkdown, githubSource, isProposalMarkdown } from "../utils/proposalContent";
import * as sources from "../utils/proposalContent";
import { validEIPs } from "../data/validEIPs";
import obsoleteFixtures from "./fixtures/obsolete-proposal-index.json";
import type { ValidEIPs } from "../types";
import * as generator from "./getWIPEIPsFromPRs";
import * as indexer from "./fetchValidEIPs";
import { getProposalContent, readBundledMarkdown } from "../utils/proposalContent.server";

const url = "https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-8130.md";
const markdown = "---\neip: 8130\ntitle: Keystore Accounts\n---\n# Abstract\nActual proposal content.";
const error = "<html>Error 503 Backend.max_conn reached<br>Varnish cache server</html>";
const draft = { markdownPath: "https://raw.githubusercontent.com/alice/ERCs/refs/heads/feature/accounts/ERCS/erc-8287.md", prNo: 1796, isERC: true };

test("active PRs follow the preserved upstream head, including subsequent revisions", async () => {
  assert.equal(typeof sources.resolveProposalSource, "function", "PR source resolver missing");
  for (const sha of ["a".repeat(40), "b".repeat(40)]) {
    const source = await sources.resolveProposalSource("eip", draft, fakeFetch([
      Response.json({ state: "open", merged: false, head: { sha } }),
      Response.json([{ status: "added", filename: "ERCS/erc-8287.md" }]),
    ]));
    assert.equal(source.markdownPath, "https://raw.githubusercontent.com/ethereum/ERCs/refs/pull/1796/head/ERCS/erc-8287.md");
    assert.equal(source.prState, "open");
    assert.equal(githubSource(source.markdownPath).ref, "refs/pull/1796/head");
  }
});

test("closed unmerged PRs retain their final upstream commit even with a deleted fork", async () => {
  const sha = "3".repeat(40);
  const source = await sources.resolveProposalSource("eip", draft, fakeFetch([
    Response.json({ state: "closed", merged: false, head: { sha, repo: null } }),
    Response.json([{ status: "added", filename: "ERCS/erc-8287.md" }]),
  ]));
  assert.equal(source.markdownPath, `https://raw.githubusercontent.com/ethereum/ERCs/${sha}/ERCS/erc-8287.md`);
  assert.equal(source.prState, "closed");
  assert.equal(source.prHeadSha, sha);
});

test("merged PRs use current official content, never the author's former branch", async () => {
  const source = await sources.resolveProposalSource("eip", { ...draft, isERC: false,
    markdownPath: "https://raw.githubusercontent.com/alice/EIPs/refs/heads/dev/EIPS/eip-7944.md", prNo: 9813 },
    fakeFetch([Response.json({ state: "closed", merged: true }), Response.json([{ status: "added", filename: "EIPS/eip-7944.md" }])]));
  assert.equal(source.markdownPath, "https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-7944.md");
  assert.equal(source.prState, "merged");
});

test("lifecycle outages recover legacy entries from the upstream pull ref without guessing canonical content", async () => {
  const source = await sources.resolveProposalSource("eip", draft, fakeFetch([new Response("rate limited", { status: 403 })]));
  assert.equal(source.markdownPath, "https://raw.githubusercontent.com/ethereum/ERCs/refs/pull/1796/head/ERCS/erc-8287.md");
  assert.equal(source.prState, undefined);
  const closed = { ...draft, prState: "closed" as const, prHeadSha: "c".repeat(40) };
  assert.equal((await sources.resolveProposalSource("eip", closed, fakeFetch([new Error("offline")]))).markdownPath,
    `https://raw.githubusercontent.com/ethereum/ERCs/${closed.prHeadSha}/ERCS/erc-8287.md`);
});

test("runtime repairs checked-in PR sources and exposes lifecycle without replacing failed drafts", async () => {
  const calls: string[] = [];
  const result = await getProposalContent("eip", "8287", {
    resolve: async (kind, proposal) => sources.proposalSourceFromPR(kind, proposal, { state: "closed", merged: false, head: { sha: "3".repeat(40) } }),
    remote: async (source) => { calls.push(source); return markdown.replace("8130", "8287"); },
  });
  assert.match(calls[0], /ethereum\/ERCs\/3333333333333333333333333333333333333333\/ERCS\/erc-8287.md$/);
  assert.equal(result.prState, "closed");
  await assert.rejects(getProposalContent("eip", "8287", {
    resolve: async (kind, proposal) => sources.preservedProposalSource(kind, proposal),
    remote: async () => { throw new Error("offline"); },
  }), /unavailable/);
});

test("validated Markdown must belong to the requested file, not another proposal with the same status", async () => {
  const wrong = markdown.replace("eip: 8130", "eip: 20");
  await assert.rejects(fetchRemoteMarkdown(url, fakeFetch([new Response(wrong), new Response(error)])), /unavailable/);
});

test("merged proposals renumbered in the same PR follow the evidenced final file, not a guessed number", async () => {
  const source = await sources.resolveProposalSource("eip", { ...draft, isERC: false,
    title: "Tx Ordering via Block-level Randomness", markdownPath: "https://raw.githubusercontent.com/alice/EIPs/master/EIPS/eip-7944.md", prNo: 9813 },
    fakeFetch([Response.json({ state: "closed", merged: true }),
      Response.json([{ status: "added", filename: "EIPS/eip-7956.md", patch: "+title: Tx Ordering via Block-level Randomness" }])]));
  assert.equal(source.markdownPath, "https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-7956.md");
});

test("generation refreshes known closed PRs and never confuses equal PR numbers across repositories", () => {
  assert.equal(typeof sources.trackedPRNumbers, "function", "tracked PR discovery missing");
  const entries = {
    closed: { ...draft, prNo: 9 },
    other: { ...draft, isERC: false, prNo: 7, markdownPath: url },
  };
  assert.deepEqual(sources.trackedPRNumbers("ERCs", [1, 1], entries), [1, 9]);
  assert.deepEqual(sources.trackedPRNumbers("EIPs", [], entries), [7]);
});

test("generator reads the preserved PR revision, not a same-number local checkout, and retains closed history", async () => {
  assert.equal(typeof generator.fetchDataFromPRs, "function", "testable PR generator missing");
  const calls: string[] = [];
  const generated = await generator.fetchDataFromPRs({ orgName: "ethereum", repo: "EIPs", folderName: "EIPS", filePrefix: "eip" }, {
    existing: { "8130": { title: "old", ...draft, isERC: false, prNo: 99, markdownPath: url.replace("ethereum", "alice") } },
    open: async () => [],
    pr: async () => ({ prData: { state: "closed", merged: false, head: { sha: "c".repeat(40), repo: null } } }),
    files: async () => [{ status: "added", filename: "EIPS/eip-8130.md" }],
    markdown: async source => { calls.push(source); return markdown; },
  });
  assert.deepEqual(calls, [`https://raw.githubusercontent.com/ethereum/EIPs/${"c".repeat(40)}/EIPS/eip-8130.md`]);
  assert.equal(generated["8130"].prState, "closed");
  assert.equal(generated["8130"].title, "Keystore Accounts");
});

test("lifecycle labels clearly distinguish a closed unmerged draft from proposal status", () => {
  assert.equal(typeof sources.proposalLifecycleLabel, "function", "lifecycle label missing");
  assert.equal(sources.proposalLifecycleLabel("closed"), "PR closed (unmerged)");
  assert.equal(sources.proposalLifecycleLabel("open"), "PR open");
  assert.equal(sources.proposalLifecycleLabel("merged"), "PR merged");
  assert.equal(sources.proposalLifecycleLabel(undefined), undefined);
});

test("checked-in 8287 survives lifecycle API outages without an old-number alias", () => {
  assert.equal(validEIPs["8287"].markdownPath, "https://raw.githubusercontent.com/ethereum/ERCs/3347f7f48fe921a7bff9826e40fe7f81a25da3cb/ERCS/erc-8287.md");
  assert.equal(validEIPs["8287"].prState, "closed");
  assert.equal(validEIPs["7944"], undefined);
  assert.equal(validEIPs["7956"].prNo, undefined);
});

test("unproven merged file identity cannot map a fork draft to unrelated same-number official content", async () => {
  for (const files of [Response.json([{ status: "added", filename: "ERCS/erc-9999.md", patch: "+title: Unrelated" }]), new Response("rate limited", { status: 403 })]) {
    const source = await sources.resolveProposalSource("eip", draft, fakeFetch([Response.json({ state: "closed", merged: true }), files]));
    assert.match(source.markdownPath, /refs\/pull\/1796\/head\/ERCS\/erc-8287.md$/);
  }
});

test("generation does not persist an unproven merged same-number substitution", async () => {
  const generated = await generator.fetchDataFromPRs({ orgName: "ethereum", repo: "EIPs", folderName: "EIPS", filePrefix: "eip" }, {
    existing: { "8130": { title: "Keystore Accounts", prNo: 99, markdownPath: url.replace("ethereum", "alice") } },
    open: async () => [], pr: async () => ({ prData: { state: "closed", merged: true } }),
    files: async () => [{ status: "added", filename: "EIPS/eip-9999.md", patch: "+title: Unrelated" }],
    markdown: async source => markdown.replace("8130", source.includes("9999") ? "9999" : "8130"),
  });
  assert.equal(generated["8130"], undefined);
});

test("generator refreshes active content on every run and switches merged PRs to official sources", async () => {
  const calls: string[] = [];
  for (const [state, merged, title] of [["open", false, "First revision"], ["open", false, "Updated revision"], ["closed", true, "Official revision"]] as const) {
    const generated = await generator.fetchDataFromPRs({ orgName: "ethereum", repo: "EIPs", folderName: "EIPS", filePrefix: "eip" }, {
      existing: {}, open: async () => [99],
      pr: async () => ({ prData: { state, merged } }),
      files: async () => [{ status: "added", filename: "EIPS/eip-8130.md" }],
      markdown: async source => { calls.push(source); return markdown.replace("Keystore Accounts", title); },
    });
    assert.equal(generated["8130"].title, title);
  }
  assert.deepEqual(calls, [url.replace("master", "refs/pull/99/head"), url.replace("master", "refs/pull/99/head"), url]);
});

test("generator rejects HTTP-error bodies and mismatched Markdown rather than persisting them", async () => {
  for (const body of [error, "404: Not Found", markdown.replace("8130", "20")]) {
    const generated = await generator.fetchDataFromPRs({ orgName: "ethereum", repo: "EIPs", folderName: "EIPS", filePrefix: "eip" }, {
      existing: {}, open: async () => [99], pr: async () => ({ prData: { state: "open", merged: false } }),
      files: async () => [{ status: "added", filename: "EIPS/eip-8130.md" }], markdown: async () => body,
    });
    assert.deepEqual(generated, {});
  }
});

test("runtime keeps canonical bundled fallback during an upstream outage", async () => {
  const result = await getProposalContent("eip", "8130", { resolve: async (_kind, proposal) => proposal, remote: async () => { throw new Error("offline"); } });
  assert.equal(result.source, "bundled");
  assert.ok(isProposalMarkdown(result.markdown, result.markdownPath));
});

test("PR file reconciliation uses explicit rename lineage and declines ambiguous or unrelated additions", () => {
  const rename = { status: "renamed", previous_filename: "ERCS/erc-8287.md", filename: "ERCS/erc-8288.md" };
  assert.match(sources.reconcilePRFile(draft, [rename]).markdownPath, /ERCS\/erc-8288.md$/);
  const titled = { ...draft, title: "Draft" };
  const added = { status: "added", filename: "ERCS/erc-9998.md", patch: "+title: Draft" };
  assert.equal(sources.reconcilePRFile(titled, [added, { ...added, filename: "ERCS/erc-9999.md" }]), titled);
  assert.equal(sources.reconcilePRFile(titled, [{ ...added, filename: "EIPS/eip-9998.md" }]), titled);
});

test("preserved PR heads retain exact API ref and current Markdown through CDN fallback", async () => {
  const source = "https://raw.githubusercontent.com/ethereum/EIPs/refs/pull/99/head/EIPS/eip-8130.md";
  const calls: string[] = [];
  assert.equal(await fetchRemoteMarkdown(source, fakeFetch([new Response("404", { status: 404 }), new Response(markdown)], calls)), markdown);
  assert.equal(calls[1], "https://api.github.com/repos/ethereum/EIPs/contents/EIPS/eip-8130.md?ref=refs%2Fpull%2F99%2Fhead");
});

test("PR file pagination preserves a renamed path beyond the first 100 files", async () => {
  const calls: string[] = [];
  const source = await sources.resolveProposalSource("eip", draft, fakeFetch([
    Response.json({ state: "open", merged: false }),
    Response.json(Array.from({ length: 100 }, (_, i) => ({ status: "modified", filename: `assets/${i}.png` }))),
    Response.json([{ status: "renamed", previous_filename: "ERCS/erc-8287.md", filename: "ERCS/erc-8288.md" }]),
  ], calls));
  assert.match(source.markdownPath, /refs\/pull\/1796\/head\/ERCS\/erc-8288.md$/);
  assert.match(calls[2], /per_page=100&page=2$/);
});

test("RIP and CAIP PRs use their own upstream repositories and default branches", async () => {
  for (const [kind, path, upstream, branch] of [
    ["rip", "RIPS/rip-1.md", "ethereum/RIPs", "master"],
    ["caip", "CAIPs/caip-1.md", "ChainAgnostic/CAIPs", "main"],
  ] as const) {
    const proposal = { prNo: 5, markdownPath: `https://raw.githubusercontent.com/alice/${upstream.split("/")[1]}/refs/heads/feature/nested/${path}` };
    const source = await sources.resolveProposalSource(kind, proposal, fakeFetch([
      Response.json({ state: "closed", merged: true }), Response.json([{ status: "added", filename: path }]),
    ]));
    assert.equal(source.markdownPath, `https://raw.githubusercontent.com/${upstream}/${branch}/${path}`);
  }
});

test("index refresh removes merged old IDs and preserves current official entries including reused IDs", async () => {
  const old = { title: "Tx Ordering via Block-level Randomness", prNo: 9813, markdownPath: url.replace("8130", "7944") };
  const official = { title: "Current official revision", markdownPath: url.replace("8130", "7956") };
  const removed = new Set<string>();
  const generated = await generator.fetchDataFromPRs({ orgName: "ethereum", repo: "EIPs", folderName: "EIPS", filePrefix: "eip" }, {
    existing: { "7944": old, "7956": official }, open: async () => [],
    pr: async () => ({ prData: { state: "closed", merged: true } }),
    files: async () => [{ status: "added", filename: "EIPS/eip-7956.md", patch: `+title: ${old.title}` }],
    markdown: async () => markdown.replace("8130", "7956"),
    onRemove: key => removed.add(key),
  });
  assert.equal(generated["7944"], undefined);
  assert.ok(removed.has("7944"));
  assert.equal(typeof indexer.mergeIndexData, "function");
  const merged = indexer.mergeIndexData({ "7944": old, "7956": official }, generated, removed);
  assert.equal(merged["7944"], undefined);
  assert.deepEqual(merged["7956"], official);
  const reused = { title: "Real reused proposal", markdownPath: url.replace("8130", "7944") };
  assert.deepEqual(indexer.mergeIndexData({ "7944": reused, "7956": official }, generated, removed)["7944"], reused);
});

test("index refresh removes an obsolete active ID when the sole current file is validated and already indexed for that PR despite a changed title", async () => {
  const old = { title: "Old title", prNo: 99, markdownPath: url.replace("8130", "8888") };
  const current = { title: "Keystore Accounts", prNo: 99, markdownPath: url };
  const removed = new Set<string>();
  const generated = await generator.fetchDataFromPRs({ orgName: "ethereum", repo: "EIPs", folderName: "EIPS", filePrefix: "eip" }, {
    existing: { "8888": old, "8130": current }, open: async () => [],
    pr: async () => ({ prData: { state: "open", merged: false } }),
    files: async () => [{ status: "added", filename: "EIPS/eip-8130.md", patch: "+title: Keystore Accounts" }],
    markdown: async source => { if (source.endsWith("eip-8888.md")) throw new Error("obsolete file"); return markdown; },
    onRemove: key => removed.add(key),
  });
  assert.deepEqual(Array.from(removed), ["8888"]);
  const merged = indexer.mergeIndexData({ "8888": old, "8130": current }, generated, removed);
  assert.equal(merged["8888"], undefined);
  assert.equal(merged["8130"].title, current.title);
});

test("index refresh never removes history before replacement Markdown validation", async () => {
  for (const merged of [false, true]) for (const body of [new Error("offline"), error, markdown.replace("8130", "20")]) {
    const old = { title: "Keystore Accounts", prNo: 99, markdownPath: url.replace("8130", "8888") };
    const removed = new Set<string>();
    const generated = await generator.fetchDataFromPRs({ orgName: "ethereum", repo: "EIPs", folderName: "EIPS", filePrefix: "eip" }, {
      existing: { "8888": old }, open: async () => [],
      pr: async () => ({ prData: { state: merged ? "closed" : "open", merged } }),
      files: async () => [{ status: "renamed", previous_filename: "EIPS/eip-8888.md", filename: "EIPS/eip-8130.md" }],
      markdown: async () => { if (body instanceof Error) throw body; return body; },
      onRemove: key => removed.add(key),
    });
    assert.deepEqual(Array.from(removed), []);
    assert.deepEqual(indexer.mergeIndexData({ "8888": old }, generated, removed), { "8888": old });
  }
});

for (const fixture of obsoleteFixtures) {
  test(`verified ${fixture.repo} PR #${fixture.pr} retires ${fixture.old} and preserves ${fixture.new}`, async () => {
    const removed = new Set<string>();
    const existing = fixture.existing as unknown as ValidEIPs;
    const generated = await generator.fetchDataFromPRs({ orgName: "ethereum", repo: fixture.repo,
      folderName: fixture.repo === "ERCs" ? "ERCS" : "EIPS", filePrefix: fixture.repo === "ERCs" ? "erc" : "eip", isERC: fixture.repo === "ERCs" }, {
      existing, open: async () => [], pr: async () => ({ prData: fixture.prData }), files: async () => fixture.files,
      markdown: async source => {
        assert.equal(githubSource(source).file, githubSource(existing[fixture.new].markdownPath).file);
        return fixture.markdown;
      },
      onRemove: key => removed.add(key),
    });
    assert.ok(removed.has(fixture.old));
    const merged = indexer.mergeIndexData(existing, generated, removed);
    assert.equal(merged[fixture.old], undefined);
    assert.equal(merged[fixture.new].title, existing[fixture.new].title);
    if (!existing[fixture.new].prNo) assert.deepEqual(merged[fixture.new], existing[fixture.new]);
  });
}

test("checked-in index excludes the 12 verified obsolete IDs and retains their current proposals", () => {
  for (const fixture of obsoleteFixtures) {
    assert.equal(validEIPs[fixture.old], undefined, `obsolete ${fixture.old} still indexed`);
    assert.equal(validEIPs[fixture.new].title, (fixture.existing as unknown as ValidEIPs)[fixture.new].title);
  }
});

test("duplicate cleanup declines ambiguous PRs, missing index identity, surviving old files, and unavailable replacement content", async () => {
  const old = { title: "Old title", prNo: 99, markdownPath: url.replace("8130", "8888") };
  const current = { title: "Keystore Accounts", prNo: 99, markdownPath: url };
  const added = { status: "added", filename: "EIPS/eip-8130.md", patch: "+title: Keystore Accounts" };
  for (const scenario of [
    { current, files: [added] }, // A still-valid old source is not obsolete.
    { current, files: [added, { ...added, filename: "EIPS/eip-8131.md", patch: "+title: Other" }] },
    { current: undefined, files: [added] },
    { current: { ...current, prNo: 100 }, files: [added] },
    { current: { ...current, markdownPath: url.replace("EIPs", "ERCs") }, files: [added] },
    { current: { ...current, prNo: undefined }, files: [added] },
    { current, files: [added, { status: "modified", filename: "EIPS/eip-8888.md" }] },
    { current, files: [added], invalid: true },
    { current, files: [added], unavailable: true },
    { current, files: [added], lifecycleOutage: true },
    { current, files: [added], filesOutage: true },
  ]) {
    const removed = new Set<string>();
    await generator.fetchDataFromPRs({ orgName: "ethereum", repo: "EIPs", folderName: "EIPS", filePrefix: "eip" }, {
      existing: { "8888": old, ...(scenario.current ? { "8130": scenario.current } : {}) }, open: async () => [],
      pr: async () => { if (scenario.lifecycleOutage) throw new Error("offline"); return { prData: { state: "open", merged: false } }; },
      files: async () => { if (scenario.filesOutage) throw new Error("offline"); return scenario.files; },
      markdown: async source => {
        if (scenario.unavailable) throw new Error("offline");
        return scenario.invalid ? error : markdown.replace("8130", githubSource(source).file.match(/-(\d+)\.md$/)![1]);
      }, onRemove: key => removed.add(key),
    });
    assert.deepEqual(Array.from(removed), []);
  }
});

test("runtime rejects cross-number source resolution before the next index refresh", async () => {
  await assert.rejects(getProposalContent("eip", "8287", {
    resolve: async () => ({ ...draft, markdownPath: url.replace("8130", "7956") }),
    remote: async () => markdown.replace("8130", "7956"),
  }), /unavailable/);
});

test("client rejects an API payload whose source and Markdown agree on the wrong requested ID", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = fakeFetch([Response.json({ markdown: markdown.replace("8130", "7956"), markdownPath: url.replace("8130", "7956"), isERC: false, source: "remote" })]);
  try { await assert.rejects(sources.fetchProposalContent("eip", "7944"), /Invalid proposal content/); }
  finally { globalThis.fetch = previous; }
});

test("a reused old number reads its real official proposal rather than the former PR", async () => {
  const previous = validEIPs["7944"];
  const official = { title: "Real reused proposal", markdownPath: url.replace("8130", "7944"), isERC: false };
  validEIPs["7944"] = official;
  try {
    const content = await getProposalContent("eip", "7944", {
      resolve: async (_kind, proposal) => { assert.equal(proposal.prNo, undefined); return proposal; },
      remote: async source => { assert.equal(source, official.markdownPath); return markdown.replace("8130", "7944").replace("Keystore Accounts", official.title); },
    });
    assert.match(content.markdown, /eip: 7944/);
    assert.match(content.markdown, /Real reused proposal/);
    assert.equal(content.prNo, undefined);
  } finally {
    if (previous) validEIPs["7944"] = previous;
    else delete validEIPs["7944"];
  }
});

function fakeFetch(responses: (Response | Error)[], calls: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    calls.push(String(input));
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, "Unexpected extra upstream request");
    return response;
  }) as typeof fetch;
}

test("503 from raw CDN falls back to GitHub API with real Markdown", async () => {
  const calls: string[] = [];
  assert.equal(await fetchRemoteMarkdown(url, fakeFetch([
    new Response(error, { status: 503 }), new Response(markdown),
  ], calls)), markdown);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].startsWith("https://api.github.com/repos/ethereum/EIPs/contents/"));
});

test("HTTP 200 error pages are rejected too", async () => {
  assert.equal(await fetchRemoteMarkdown(url, fakeFetch([new Response(error), new Response(markdown)])), markdown);
  assert.equal(isProposalMarkdown(error), false);
  assert.equal(isProposalMarkdown("404: Not Found"), false);
});

test("network failures fall back and total outages throw instead of returning errors as content", async () => {
  assert.equal(await fetchRemoteMarkdown(url, fakeFetch([new Error("timeout"), new Response(markdown)])), markdown);
  await assert.rejects(fetchRemoteMarkdown(url, fakeFetch([new Response(error, { status: 503 }), new Response(error, { status: 429 })])), /unavailable/);
});

test("PR refs containing slashes preserve the exact branch", () => {
  assert.equal(githubSource("https://raw.githubusercontent.com/alice/EIPs/refs/heads/feature/accounts/EIPS/eip-0.md").apiURL,
    "https://api.github.com/repos/alice/EIPs/contents/EIPS/eip-0.md?ref=feature%2Faccounts");
  assert.throws(() => githubSource("https://example.com/alice/EIPs/master/EIPS/eip-1.md"));
});

test("bundled EIP, ERC, RIP and CAIP sources contain valid proposal data", async () => {
  for (const source of [url,
    "https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-20.md",
    "https://raw.githubusercontent.com/ethereum/RIPs/master/RIPS/rip-7560.md",
    "https://raw.githubusercontent.com/ChainAgnostic/CAIPs/main/CAIPs/caip-2.md",
  ]) assert.ok(isProposalMarkdown(await readBundledMarkdown(source)));
  assert.match(await readBundledMarkdown(url), /title: Keystore Accounts/);
});

test("a PR or non-default branch cannot silently fall back to a different bundled proposal", async () => {
  await assert.rejects(readBundledMarkdown(url.replace("/ethereum/", "/alice/")), /No matching/);
  await assert.rejects(readBundledMarkdown(url.replace("/master/", "/feature/")), /No matching/);
});
