import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';

// Run against node --import ./scripts/proposal-outage.preload.mjs
// node_modules/next/dist/bin/next start (use an unused port),
// after moving this worktree's .next/cache/fetch-cache aside (cold cache).
const origin = process.env.SEO_TEST_ORIGIN;
assert.ok(origin, 'Specify the forced-outage production server in SEO_TEST_ORIGIN');
test('known proposals keep bundled recovery or retry, never a 404 during a total upstream outage', async () => {
  for (const [kind, number] of [['eip', '4337'], ['rip', '7212'], ['caip', '2']]) {
    const response = await fetch(`${origin}/${kind}/${number}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<article\b/);
    const api = await fetch(`${origin}/api/proposals/${kind}/${number}`);
    assert.equal(api.status, 200);
    assert.equal((await api.json()).source, 'bundled');
  }
  const response = await fetch(`${origin}/eip/8287`);
  assert.equal(response.status, 200);
  assert.doesNotMatch(await response.text(), /<meta name="robots" content="[^"]*noindex/);
  const api = await fetch(`${origin}/api/proposals/eip/8287`);
  assert.equal(api.status, 503);
  assert.equal(api.headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(`${origin}/eip/8401`)).status, 404);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(origin).origin ? route.continue() : route.abort());
    const navigation = await page.goto(`${origin}/eip/8287`, { waitUntil: 'networkidle' });
    assert.equal(navigation.status(), 200);
    await page.getByRole('alert').filter({ hasText: 'This proposal is temporarily unavailable' }).waitFor();
    const retry = page.getByRole('button', { name: 'Try again' });
    assert.ok(await retry.isVisible());
    const retried = page.waitForResponse(r => r.url().endsWith('/api/proposals/eip/8287'));
    await retry.click();
    assert.equal((await retried).status(), 503);
    assert.ok(await retry.isVisible());
  } finally { await browser.close(); }
});
