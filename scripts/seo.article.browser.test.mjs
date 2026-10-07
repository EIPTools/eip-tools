import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from '@playwright/test';

const origin = process.env.SEO_TEST_ORIGIN || 'http://127.0.0.1:4317';
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

// Retain local hydration assets, but never let article tests reach external hosts.
async function isolateArticle(context) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(origin).origin || url.pathname.startsWith('/api/proposals/')) return route.abort('failed');
    return route.continue();
  });
}

for (const path of ['/eip/2', '/rip/7993', '/caip/104', '/eip/8287', '/eip/7956']) {
  test(`${path}: initial and hydrated real article has only title H1 and working TOC anchors`, async () => {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200);
    const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, 'one H1 in initial HTML, not RSC strings');
    assert.match(html, /<article\b/);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    try {
      const errors = [];
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await isolateArticle(context);
      await page.goto(`${origin}${path}`, { waitUntil: 'networkidle', timeout: 120000 });
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('article h1').count(), 0);
      if (path === '/eip/8287') assert.ok((await page.locator('body').innerText()).includes('PR closed (unmerged)'));
      if (path === '/eip/7956') assert.ok((await page.locator('body').innerText()).includes('Stagnant'));
      const tocLinks = page.locator('nav[aria-label="Proposal table of contents"] [data-proposal-toc-id]');
      const targets = await tocLinks.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-proposal-toc-id')));
      assert.ok(targets.length > 0);
      for (const id of targets) {
        assert.equal(await page.locator(`article [id="${id}"]`).count(), 1, `unique TOC target ${id}`);
        assert.match(await page.evaluate(id => document.getElementById(id)?.tagName ?? '', id), /^H[2-6]$/, `TOC ${id} resolves a heading, not a raw alias`);
      }
      const link = tocLinks.first();
      const id = await link.getAttribute('data-proposal-toc-id');
      await link.click();
      assert.equal(new URL(page.url()).hash, `#${id}`);
      assert.equal(await page.evaluate(() => document.activeElement?.id), id);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
}

test('/eip/7944: unavailable numeric route never hydrates the renumbered proposal', async () => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(origin).origin ? route.continue() : route.abort('failed'));
    const page = await context.newPage();
    await page.goto(`${origin}/eip/7944`, { waitUntil: 'networkidle', timeout: 120000 });
    const unavailable = page.getByRole('alert').filter({ hasText: 'This proposal is temporarily unavailable' });
    await unavailable.waitFor();
    assert.match(await unavailable.innerText(), /This proposal is temporarily unavailable/);
    assert.equal(await page.locator('article').count(), 0);
    assert.ok(!(await page.locator('body').innerText()).includes('Renumbered to'));
    assert.ok(!(await page.locator('body').innerText()).includes('Proposers and builders can currently permute'));
  } finally { await context.close(); }
});

test('/rip/7759: initial and hydrated named reference targets resolve on fragment clicks', async () => {
  const response = await fetch(`${origin}/rip/7759`);
  assert.equal(response.status, 200);
  const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  assert.match(html, /name="user-content-r1"/);
  assert.match(html, /href="#user-content-r1"/);
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await isolateArticle(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/rip/7759`, { waitUntil: 'networkidle', timeout: 120000 });
    assert.equal(await page.locator('article a[name="user-content-r1"]').count(), 1);
    await page.locator('article a[href="#user-content-r1"]').first().click();
    assert.equal(new URL(page.url()).hash, '#user-content-r1');
    assert.equal(await page.evaluate(() => document.getElementsByName(decodeURIComponent(location.hash.slice(1))).length), 1);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
