import assert from 'node:assert/strict';
import test from 'node:test';

const origin = process.env.SEO_TEST_ORIGIN || 'http://127.0.0.1:4317';
const paths = ['/', '/eips', '/ercs', '/rips', '/caips', '/graph', '/eip/4337', '/eip/7702', '/rip/7212', '/caip/2'];
test('proposal Markdown is present in the initial HTML, not just the client fetch', async () => {
  const html = await (await fetch(`${origin}/eip/4337`)).text();
  const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  assert.ok(/<h2[^>]*[\s\S]*?Abstract/.test(body), 'server-rendered Abstract missing');
  assert.ok(body.includes('This document is an account abstraction proposal'), 'server-rendered proposal text missing');
});

for (const [path, text] of [['/rip/7212', 'This proposal creates a precompiled contract'], ['/caip/2', 'CAIP-2 defines a way to identify a blockchain']]) {
  test(`${path} includes actual proposal text before hydration`, async () => {
    const html = await (await fetch(`${origin}${path}`)).text();
    const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    assert.ok(body.includes(text), `${path}: server proposal text missing`);
  });
}

for (const path of paths) {
  test(`${path} has one visible server-rendered primary heading and complete metadata`, async () => {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    assert.equal(headings.length, 1, `${path}: expected one H1 in initial HTML`);
    assert.ok(headings[0][1].replace(/<[^>]*>/g, '').trim());
    assert.doesNotMatch(headings[0][0], /hidden|display:\s*none|visibility:\s*hidden/);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
    assert.ok(canonical, `${path}: canonical missing`);
    assert.equal(new URL(canonical[1]).href, new URL(path, 'https://eip.tools').href);
    for (const name of ['og:title', 'og:description', 'og:url', 'og:site_name', 'og:image']) {
      assert.match(html, new RegExp(`<meta property="${name}" content="[^\"]+"`), `${path}: ${name}`);
    }
    assert.match(html, /<meta name="description" content="[^\"]+"/);
    assert.doesNotMatch(html, /(?:content|href)="undefined\//);
  });
}
