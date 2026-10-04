import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const origin = process.env.SEO_TEST_ORIGIN || 'http://127.0.0.1:4317';
test('hydrated representative pages keep visible headings and real proposal content during a client API outage', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await mkdir('node_modules/.cache/seo-review', { recursive: true });
  try {
    const page = await context.newPage();
    await page.route('**/api/proposals/**', route => route.abort('failed'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const path of ['/eip/4337', '/rip/7212', '/caip/2', '/', '/ercs']) {
      await page.goto(`${origin}${path}`, { waitUntil: 'networkidle', timeout: 120000 });
      const heading = page.locator('h1');
      assert.equal(await heading.count(), 1, `${path}: one hydrated H1`);
      assert.ok(await heading.isVisible(), `${path}: H1 visible`);
      const proposalText = {
        '/eip/4337': 'This document is an account abstraction proposal',
        '/rip/7212': 'This proposal creates a precompiled contract',
        '/caip/2': 'CAIP-2 defines a way to identify a blockchain',
      }[path];
      if (proposalText) {
        assert.ok((await page.locator('body').innerText()).includes(proposalText), `${path}: hydrated source content remains available`);
        assert.ok(await page.getByRole('heading', { name: 'Abstract', exact: true }).isVisible());
      }
      if (path === '/ercs') {
        assert.ok(await page.locator('a[href="/eip/4337"]').count() > 0, 'directory links to the real ERC');
      }
      await page.screenshot({ path: `node_modules/.cache/seo-review/${path === '/' ? 'home' : path.slice(1).replaceAll('/', '-')}.png` });
      console.log(`${path}: ${await heading.innerText()} (visible after hydration)`);
    }
    assert.deepEqual(errors, [], 'no uncaught browser errors');
  } finally {
    await context.close();
    await browser.close();
  }
});
