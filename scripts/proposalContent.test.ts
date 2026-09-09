import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchRemoteMarkdown, githubSource, isProposalMarkdown } from "../utils/proposalContent";
import { readBundledMarkdown } from "../utils/proposalContent.server";

const url = "https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-8130.md";
const markdown = "---\neip: 8130\ntitle: Keystore Accounts\n---\n# Abstract\nActual proposal content.";
const error = "<html>Error 503 Backend.max_conn reached<br>Varnish cache server</html>";

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
