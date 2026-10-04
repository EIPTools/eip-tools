import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const origin = process.env.SEO_TEST_ORIGIN || 'http://127.0.0.1:4317';
test('sitemap includes exactly the public directories and checked-in indexed proposal routes', async () => {
  const expected = new Set(['/', '/eips', '/ercs', '/rips', '/caips', '/graph', '/authors']);
  for (const [file, route] of [['eips', 'eip'], ['rips', 'rip'], ['caips', 'caip']]) {
    const index = JSON.parse(await readFile(new URL(`../data/valid-${file}.json`, import.meta.url), 'utf8'));
    for (const [key, proposal] of Object.entries(index)) {
      const number = /^\d+$/.test(key) ? key : proposal.markdownPath.match(/(?:eip|erc|rip|caip)-(\d+)\.md/i)?.[1];
      if (number) expected.add(`/${route}/${number.replace(/^0+(?=\d)/, '')}`);
    }
  }
  const response = await fetch(`${origin}/sitemap.xml`);
  assert.equal(response.status, 200, 'sitemap must exist');
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
  assert.ok(urls.every(url => url.origin === 'https://eip.tools'));
  const actual = new Set(urls.map(url => url.pathname));
  assert.equal(actual.size, urls.length, 'no duplicate canonical URLs');
  assert.deepEqual([...actual].sort(), [...expected].sort());
  assert.ok(![...actual].some(path => /^\/(?:api|admin|shared)(?:\/|$)/.test(path)));
  assert.doesNotMatch(xml, /<lastmod>/, 'do not invent modification dates');
  console.log(`Verified ${urls.length} sitemap URLs against checked-in indexes`);
});

test('bookmark state stays out of the index and robots advertises the sitemap', async () => {
  const html = await (await fetch(`${origin}/shared`)).text();
  assert.ok(/<meta name="robots" content="noindex, follow"/.test(html), 'bookmark noindex missing');
  const response = await fetch(`${origin}/robots.txt`);
  assert.equal(response.status, 200);
  const robots = await response.text();
  assert.match(robots, /Sitemap: https:\/\/eip.tools\/sitemap.xml/);
  assert.match(robots, /Disallow: \/api\//);
});

test('proposal pages expose persistent directory navigation', async () => {
  const html = await (await fetch(`${origin}/eip/4337`)).text();
  const navigation = html.match(/<nav[^>]*aria-label="Proposal directories"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(navigation, 'visible directory navigation missing');
  for (const path of ['/eips', '/ercs', '/rips', '/caips']) assert.ok(navigation[1].includes(`href="${path}"`));
});
