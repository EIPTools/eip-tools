import test from "node:test";
import assert from "node:assert/strict";
import { markdownSnippetText, matchedTerms, searchSnippet } from "../utils/searchSnippet";
import { highlightParts } from "../utils/searchHighlight";

test("complete Markdown becomes inert text without breaking code or links", () => {
  const source = '# Passport\n\n**Digital** [passport](https://example.org) and `BASE_FEE_MAX_CHANGE_DENOMINATOR`.\n\n```solidity\ninterface IRWAPassport { uint256 asset_id; }\n```\n\n- First\n- Second\n\n| Name | Value |\n| --- | --- |\n| Asset | 1 |\n\n<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>';
  const plain = markdownSnippetText(source);
  assert.equal(plain, 'Digital passport and BASE_FEE_MAX_CHANGE_DENOMINATOR. interface IRWAPassport { uint256 asset_id; } First Second Name Value Asset 1');
  assert.ok(!plain.includes('https://'));
});

test("snippets crop near the matched term after parsing complete links and fences", () => {
  const source = `${'Before context. '.repeat(50)}\n\n[passport](https://example.org)\n\n\`\`\`solidity\nuint asset_id;\n\`\`\`\n${'After context. '.repeat(50)}`;
  const snippet = searchSnippet(source, ['passport']);
  assert.ok(snippet.includes('passport'));
  assert.ok(snippet.includes('asset_id'));
  assert.ok(!snippet.includes('```') && !snippet.includes('https://'));
  assert.ok(snippet.length <= 322);
  assert.ok(searchSnippet(source, []).startsWith('Before context.'));
});

test("highlighting uses literal Unicode-safe matches and preserves original text", () => {
  const text = 'IRWAPassport passport PASSPORT asset_id a+b <script>';
  const parts = highlightParts(text, ['passport', 'asset_id', 'a+b', '<script>']);
  assert.equal(parts.map(part => part.text).join(''), text);
  assert.deepEqual(parts.filter(part => part.match).map(part => part.text), ['Passport', 'passport', 'PASSPORT', 'asset_id', 'a+b', '<script>']);
  assert.deepEqual(matchedTerms('A \uE000Passport\uE001 and \uE000asset_id\uE001'), ['Passport', 'asset_id']);
});
