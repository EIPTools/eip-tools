import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from '@playwright/test';

const origin = process.env.SEO_TEST_ORIGIN || 'http://127.0.0.1:4317';
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

for (const [kind, current, next, currentTitle, nextTitle] of [
  ['eip', '4337', '4341', 'ERC-4337: Account Abstraction Using Alt Mempool', 'ERC-4341: Ordered NFT Batch Standard'],
  ['rip', '7212', '7559', 'RIP-7212: Precompile for secp256r1 Curve Support', 'RIP-7559: RIP Purpose and Guidelines'],
  ['caip', '2', '3', 'CAIP-2: Blockchain ID Specification', 'CAIP-3: Blockchain Reference for the EIP155 Namespace'],
]) {
test(`${kind}: next-proposal loading state shows the destination title, never the old title`, async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/${kind}/${current}`, { waitUntil: 'networkidle', timeout: 120000 });
    let release;
    const navigationGate = new Promise(resolve => { release = resolve; });
    await page.route(`**/${kind}/${next}*`, async route => {
      await navigationGate;
      await route.continue();
    });
    try {
      await page.locator('h1').locator('xpath=preceding-sibling::*[2]').locator('button').last().click();
      await page.locator('.chakra-skeleton').first().waitFor({ state: 'visible' });
      assert.equal(await page.locator('h1').innerText(), nextTitle, 'pending heading must identify the target proposal');
    } finally {
      release();
    }
    await page.waitForURL(`**/${kind}/${next}`,  { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('h1').innerText(), nextTitle);
    await page.locator('h1').locator('xpath=preceding-sibling::*[2]').locator('button').first().click();
    await page.waitForURL(`**/${kind}/${current}`,  { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('h1').innerText(), currentTitle);
  } finally {
    await context.close();
  }
});
}

for (const path of ['/eip/4337', '/rip/7212', '/caip/2']) {
  for (const width of [1280, 390]) {
    test(`${path}: reader heading stays below badges and aligned with its description at ${width}px`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      try {
        const page = await context.newPage();
        await page.route('**/api/proposals/**', route => route.abort('failed'));
        await page.goto(`${origin}${path}`, { waitUntil: 'networkidle', timeout: 120000 });
        const heading = page.locator('h1');
        assert.equal(await heading.count(), 1, 'one visible reader H1');
        assert.ok(await heading.isVisible());
        const header = await heading.evaluate(node => {
          const badges = node.previousElementSibling;
          const description = node.nextElementSibling;
          return {
            badgesImmediatelyBefore: Boolean(badges?.querySelector('.chakra-badge')),
            descriptionImmediatelyAfter: description?.tagName === 'P',
            heading: node.getBoundingClientRect().toJSON(),
            badges: badges?.getBoundingClientRect().toJSON(),
            description: description?.getBoundingClientRect().toJSON(),
          };
        });
        assert.ok(header.badgesImmediatelyBefore, 'title must follow the status/bookmark row, not precede navigation');
        assert.ok(header.descriptionImmediatelyAfter, 'description remains directly below the title');
        assert.ok(header.heading.top >= header.badges.bottom, 'title sits below the badges');
        assert.ok(Math.abs(header.heading.left - header.description.left) <= 1, 'title retains the reader left alignment');
        assert.ok(header.description.top >= header.heading.bottom, 'description sits below the title');
      } finally {
        await context.close();
      }
    });
  }
}
