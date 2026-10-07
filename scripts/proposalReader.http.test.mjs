import assert from 'node:assert/strict';
import test from 'node:test';

const origin = process.env.SEO_TEST_ORIGIN || 'http://127.0.0.1:4317';
for (const path of [
  ...['8401', '363', '7875', '7953', '7559', '7759', '7212', '7944'].map(n => `/eip/${n}`),
  '/rip/999999999999', '/caip/999999999999',
  '/eip/nope', '/rip/7212junk', '/caip/2junk', '/eip/constructor',
  '/eip/1234567890123', '/eip/eip-8401.md',
]) {
  test(`${path} returns a real HTTP 404 with noindex`, async () => {
    const response = await fetch(`${origin}${path}`, { redirect: 'follow' });
    assert.equal(response.status, 404);
    assert.match(await response.text(), /<meta name="robots" content="[^"]*noindex/);
  });
}
for (const path of ['/eip/4337', '/rip/7212', '/caip/2', '/eip/010101']) {
  test(`${path} remains HTTP 200 with a numeric canonical`, async () => {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
    assert.ok(canonical);
    assert.equal(new URL(canonical[1]).pathname, path.replace(/\/0+(?=\d)/, '/'));
    assert.doesNotMatch(html, /<meta name="robots" content="[^"]*noindex/);
  });
}
for (const kind of ['eip', 'rip', 'caip']) {
  test(`unknown ${kind} API returns 404 rather than an outage`, async () => {
    const response = await fetch(`${origin}/api/proposals/${kind}/999999999999`);
    assert.equal(response.status, 404);
  });
}
