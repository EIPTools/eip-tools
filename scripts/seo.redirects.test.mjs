import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';

const origin = process.env.SEO_TEST_ORIGIN || 'http://127.0.0.1:4317';

test('HTTP filename and padded aliases redirect once with query intact to canonical HTML', async () => {
  for (const [alias, canonical] of [
    ['/eip/eip-4200.md', '/eip/4200'],
    ['/eip/eip-4200', '/eip/4200'],
    ['/eip/erc-20.md', '/eip/20'],
    ['/rip/rip-7560.md', '/rip/7560'],
    ['/caip/caip-2.md', '/caip/2'],
    ['/eip/04200', '/eip/4200'],
    ['/eip/010101', '/eip/10101'],
    ['/4200', '/eip/4200'],
  ]) {
    const response = await fetch(`${origin}${alias}?source=redirect`, { redirect: 'manual' });
    assert.equal(response.status, 308, alias);
    assert.equal(new URL(response.headers.get('location'), origin).href, `${origin}${canonical}?source=redirect`);
    const target = await fetch(`${origin}${canonical}?source=redirect`, { redirect: 'manual' });
    assert.equal(target.status, 200, canonical);
    const html = await target.text();
    assert.ok(html.includes(`<link rel="canonical" href="https://eip.tools${canonical}"`), canonical);
    if (canonical === '/eip/10101') assert.match(html, /RE-EN Quantum-Resistant Encryption/);
  }
});

test('browser inherits the original fragment across a real HTTP redirect', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/eip/eip-4200.md?source=fragment#abstract`, { waitUntil: 'domcontentloaded' });
    assert.equal(page.url(), `${origin}/eip/4200?source=fragment#abstract`);
    assert.equal(await page.locator('#abstract').count(), 1);
  } finally {
    await browser.close();
  }
});
