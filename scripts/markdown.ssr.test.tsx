import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { validEIPs } from '../data/validEIPs';
import { validRIPs } from '../data/validRIPs';
import { validCAIPs } from '../data/validCAIPs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../components/Markdown';
import { chromium } from '@playwright/test';

const source = 'https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-2.md';
const render = (md: string) => renderToStaticMarkup(<Markdown md={md} markdownFileURL={source} />);

// All document bytes come from the actual component; no app/API responses are mocked.
async function parseInBrowser(html: string, check: (page: import('@playwright/test').Page, requests: string[]) => Promise<void>) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const requests: string[] = [];
    await page.route('**/*', async route => {
      if (route.request().url() === 'http://markdown.test/') {
        await route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body>${html}</body></html>` });
      } else {
        requests.push(route.request().url());
        await route.abort();
      }
    });
    await page.goto('http://markdown.test/', { waitUntil: 'networkidle' });
    await check(page, requests);
  } finally {
    await browser.close();
  }
}

test('literal upstream script and iframe srcDoc cannot execute in parser-initial SSR HTML', async () => {
  const md = '<script>window.__seoSecurityProbe=true</script>\n<iframe srcdoc="<script>parent.__seoSecurityProbe=true</script>"></iframe>';
  await parseInBrowser(render(md), async (page, requests) => {
    assert.equal(await page.evaluate(() => (window as any).__seoSecurityProbe), undefined);
    assert.equal(await page.locator('script, iframe, [srcdoc]').count(), 0);
    assert.deepEqual(requests, []);
  });
});

test('malicious SSR bytes parsed by isolated Chromium execute nothing and request nothing externally', async () => {
  await parseInBrowser(render(maliciousMarkdown), async (page, requests) => {
    assert.equal(await page.evaluate(() => (window as any).__seoSecurityProbe), undefined);
    assert.equal(await page.locator('script, iframe, object, embed, svg, math, link, meta, form, [srcdoc]').count(), 0);
    assert.deepEqual(requests, [], 'stripped URLs must not turn into fallback image/link requests');
  });
});

test('safe proposal HTML, resolved images/links, escaped code and trusted math survive sanitation', async () => {
  const html = render(`
## Safe section
<details open><summary>Safe details</summary><table><tbody><tr><td>Safe cell</td></tr></tbody></table></details>
<img src="../assets/eip-2/safe.png" alt="Safe image" align="right">

[Safe external](https://example.org/reference)
[Proposal](./eip-606.md)
[Section](#safe-section)

\`<script>escaped</script>\`

$E = mc^2$

$$x^2 + y^2$$

$\\href{javascript:alert(1)}{bad}$
`);
  await parseInBrowser(html, async page => {
    assert.equal(await page.locator('details[open] summary').innerText(), 'Safe details');
    assert.equal(await page.locator('table td').innerText(), 'Safe cell');
    assert.match(await page.locator('img').getAttribute('src') ?? '', /ethereum\/EIPs\/refs\/heads\/master\/assets\/eip-2\/safe.png$/);
    assert.equal(await page.locator('img').evaluate(node => getComputedStyle(node).float), 'right');
    assert.equal(await page.locator('a', { hasText: 'Safe external' }).getAttribute('href'), 'https://example.org/reference');
    assert.equal(await page.getByRole('link', { name: 'Proposal', exact: true }).getAttribute('href'), '/eip/606');
    assert.equal(await page.locator('article a', { hasText: 'Section' }).getAttribute('href'), '#safe-section');
    assert.equal(await page.locator('code').first().innerText(), '<script>escaped</script>');
    assert.ok(await page.locator('.katex').count() >= 2);
    assert.ok(await page.locator('.katex math').count() >= 2, 'only trusted generated MathML is retained');
    assert.equal(await page.locator('script, iframe, a[href^="javascript:"]').count(), 0);
  });
});

test('sanitizer-empty raw code renders without crashing and keeps empty and escaped code safe', async () => {
  const html = render('<code><script>window.__seoSecurityProbe=true</script></code>\n\n<code></code>\n\n```js\n```\n\n`<script>escaped</script>`\n\n```html\n<script>fenced</script>\n```');
  await parseInBrowser(html, async (page, requests) => {
    assert.equal(await page.locator('article code').count(), 5);
    assert.equal(await page.locator('article code').nth(0).textContent(), '');
    assert.equal(await page.locator('article code').nth(1).textContent(), '');
    assert.equal(await page.locator('article code').nth(2).textContent(), '');
    assert.equal(await page.locator('article code').nth(3).textContent(), '<script>escaped</script>');
    assert.match(await page.locator('article code').nth(4).textContent() ?? '', /<script>fenced<\/script>/);
    assert.equal(await page.locator('script').count(), 0);
    assert.equal(await page.evaluate(() => (window as any).__seoSecurityProbe), undefined);
    assert.deepEqual(requests, []);
  });
});

test('RIP-7759 named reference anchors survive sanitation and actual fragment clicks resolve', async () => {
  assert.ok(validRIPs['7759'], 'fixture must be indexed');
  const md = readFileSync('submodules/RIPs/RIPS/rip-7759.md', 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  assert.match(md, /<a name="r1">/);
  await parseInBrowser(render(md), async (page, requests) => {
    const names = Array.from(md.matchAll(/<a name="([^"]+)">/g), match => match[1]);
    assert.ok(names.includes('r1') && names.includes('r2'));
    assert.equal(await page.locator('article a[name]').count(), names.length);
    for (const name of names) {
      assert.equal(await page.locator(`article a[name="user-content-${name}"]`).count(), 1);
    }
    for (const name of ['r1', 'r2']) {
      const links = page.locator(`article a[href="#user-content-${name}"]`);
      assert.ok(await links.count() > 0);
      await links.first().click();
      assert.equal(new URL(page.url()).hash, `#user-content-${name}`);
      assert.equal(await page.evaluate(() => document.getElementsByName(decodeURIComponent(location.hash.slice(1))).length), 1);
    }
    assert.ok(requests.every(url => !url.includes('raw.githubusercontent.com')), 'fragment clicks never resolve upstream');
  });
});

test('raw ID/name fragments reconcile only real sanitized targets, retain TOC and clobber protection', async () => {
  const html = render(`
## Trusted heading
<a id="inline-target"></a>
<a id="trusted-heading"></a>
<a name="encoded target"></a>
<a id="location" name="document" href="javascript:alert(1)" onclick="window.__seoSecurityProbe=true">unsafe target</a>
<a id="user-content-original"></a>

[Inline](#inline-target)
[Prefixed](#user-content-inline-target)
[Encoded](#encoded%20target)
[Encoded prefixed](#user-content-encoded%20target)
[Original prefixed name](#user-content-original)
[Clobber](#location)
[Heading](#trusted-heading)
[Unknown](#missing)
[Malformed](#bad%ZZ)
[Bad URL](javascript:alert(1))
`);
  await parseInBrowser(html, async (page, requests) => {
    assert.equal(await page.locator('a[id="user-content-inline-target"]').count(), 1);
    assert.equal(await page.locator('a[name="user-content-encoded target"]').count(), 1);
    assert.equal(await page.locator('[id="location"], [name="document"], [onclick], a[href^="javascript:"]').count(), 0);
    assert.equal(await page.locator('a[id="user-content-location"][name="user-content-document"]:not([href])').count(), 1);
    const expected = {
      Inline: '#user-content-inline-target', Prefixed: '#user-content-inline-target',
      Encoded: '#user-content-encoded%20target', 'Encoded prefixed': '#user-content-encoded%20target',
      'Original prefixed name': '#user-content-user-content-original',
      Clobber: '#user-content-location', Heading: '#trusted-heading',
    };
    for (const [label, href] of Object.entries(expected)) {
      const link = page.getByRole('link', { name: label, exact: true });
      assert.equal(await link.getAttribute('href'), href);
      await link.click();
      assert.equal(new URL(page.url()).hash, href);
      assert.ok(await page.evaluate(() => {
        const target = decodeURIComponent(location.hash.slice(1));
        return !!document.getElementById(target) || document.getElementsByName(target).length > 0;
      }), `${label} resolves an actual DOM target`);
    }
    assert.equal(await page.getByRole('link', { name: 'Unknown', exact: true }).getAttribute('href'), '#missing');
    assert.equal(await page.getByRole('link', { name: 'Malformed', exact: true }).getAttribute('href'), '#bad%ZZ');
    const toc = page.locator('[data-proposal-toc-id="trusted-heading"]').first();
    assert.equal(await toc.getAttribute('href'), '#trusted-heading');
    assert.equal(await page.locator('article a', { hasText: 'Bad URL' }).count(), 0);
    assert.equal(await page.evaluate(() => (window as any).__seoSecurityProbe), undefined);
    assert.deepEqual(requests, []);
  });
});

for (const [tag, raw] of [
  ['p', '<p id="target">Target</p>'],
  ['code', '<code id="target">Target</code>'],
  ['raw heading', '<h2 id="target">Target</h2>'],
  ['canonical proposal', '<a id="target" href="./eip-606.md">Target</a>'],
] as const) {
  test(`${tag}: authored fragments reach an actual rendered target`, async () => {
    await parseInBrowser(render(`${raw}\n\n[Jump](#target)`), async (page, requests) => {
      const link = page.getByRole('link', { name: 'Jump', exact: true });
      await link.click();
      assert.equal(await page.evaluate(() => (() => { const target = document.getElementById(decodeURIComponent(location.hash.slice(1))); return (target?.closest('h2') as HTMLElement)?.innerText ?? (target as HTMLElement)?.innerText; })()), 'Target');
      assert.deepEqual(requests, []);
    });
  });
}

for (const md of [
  '## Outer <h2 id="inner">Inner</h2>',
  '## <h2 id="inner">Inner</h2> Outer',
  '## Outer <h2 id="inner">Inner <h2>Nested</h2></h2>',
]) {
  test(`same-line raw headings cannot steal or duplicate the original ATX target: ${md}`, async () => {
    const html = render(md);
    const id = /data-proposal-toc-id="([^"]+)"/.exec(html)![1];
    assert.equal(Array.from(html.matchAll(/\sid="([^"]+)"/g)).filter(match => match[1] === id).length, 1, 'real component SSR contains exactly one trusted target');
    await parseInBrowser(html, async (page, requests) => {
      await page.setViewportSize({ width: 1600, height: 900 });
      assert.equal(await page.locator(`[id="${id}"]`).count(), 1);
      const toc = page.locator(`[data-proposal-toc-id="${id}"]:visible`).first();
      await toc.click();
      assert.equal(new URL(page.url()).hash, `#${id}`);
      assert.equal(await page.evaluate(() => document.querySelector(':target')?.tagName), 'H2');
      assert.equal(await page.evaluate(() => document.querySelector(':target') === document.querySelector('article h2')), true);
      const ids = await page.locator('article [id]').evaluateAll(nodes => nodes.map(node => node.id));
      assert.equal(new Set(ids).size, ids.length);
      assert.deepEqual(requests, []);
    });
  });
}

for (const [label, raw] of [
  ['name-only heading', '<h2 name="target">Heading</h2>'],
  ['name-only multiline code', '<pre><code name="target">one\ntwo\n</code></pre>'],
  ['id-and-name heading', '<h2 id="primary" name="target">Heading</h2>'],
  ['id-and-name multiline code', '<pre><code id="primary" name="target">one\ntwo\n</code></pre>'],
] as const) {
  test(`${label}: named fragments click a real browser target`, async () => {
    await parseInBrowser(render(`${raw}\n\n[Jump](#target)\n\n[Primary](#primary)`), async (page, requests) => {
      await page.getByRole('link', { name: 'Jump', exact: true }).click();
      assert.equal(new URL(page.url()).hash, '#user-content-target');
      assert.equal(await page.evaluate(() => {
        const target = document.querySelector(':target');
        return !!target && (target.closest('h2')?.textContent === 'Heading' || target.closest('div')?.querySelector('code')?.textContent === 'one\ntwo');
      }), true, 'name resolves a real fragment target at the authored content');
      if (raw.includes('id=')) {
        await page.getByRole('link', { name: 'Primary', exact: true }).click();
        assert.equal(await page.evaluate(() => document.querySelector(':target')?.id), 'user-content-primary');
      }
      const ids = await page.locator('article [id], article a[name]').evaluateAll(nodes => nodes.flatMap(node => [node.id, node.getAttribute('name')].filter(Boolean)));
      assert.equal(new Set(ids).size, ids.length);
      assert.deepEqual(requests, []);
    });
  });
}

test('name-only and id-plus-name targets cover renderer branches without invalid table/list children', async () => {
  const fixtures = [
    '<p>paragraph</p>', '<em>em</em>', '<del>del</del>', '<blockquote>quote</blockquote>', '<hr>',
    '<ul><li>list</li></ul>', '<ol><li>ordered</li></ol>',
    '<table><thead><tr><th>head</th></tr></thead><tbody><tr><td>cell</td></tr></tbody></table>',
    '<pre><code>one\ntwo\n</code></pre>', '<code>inline</code>',
    '<img src="javascript:alert(1)">',
    '<a href="./eip-606.md">canonical</a>', '<a href="javascript:alert(1)">inert</a>',
    '<span>default</span>', '<code class="math-inline">x^2</code>',
    '<pre><code class="language-math">y^2</code></pre>', '<span class="math-inline">z^2</span>',
    '<table></table>', '<ul></ul>',
  ];
  for (const withId of [false, true]) {
    const raws = fixtures.map((raw, index) => raw.replace(/^<(\w+)/, `<$1 ${withId ? `id="primary-${index}" ` : ''}name="named-${index}"`));
    // Nested structural renderers require aliases in existing cells, not spans
    // directly beneath table sections/rows or lists.
    raws.push('<table><thead id="primary-head" name="named-head"><tr id="primary-row" name="named-row"><th id="primary-th" name="named-th">head</th></tr></thead><tbody id="primary-body" name="named-body"><tr><td id="primary-cell" name="named-cell">cell</td></tr></tbody></table>');
    raws.push('<ul><li id="primary-item" name="named-item">item</li></ul>');
    const names = [...fixtures.map((_, index) => String(index)), 'head', 'row', 'th', 'body', 'cell', 'item'];
    await parseInBrowser(render(`${raws.join('\n\n')}\n\n${names.map(name => `[Jump ${name}](#named-${name})`).join('\n\n')}`), async (page, requests) => {
      for (const name of names) {
        await page.getByRole('link', { name: `Jump ${name}`, exact: true }).click();
        assert.equal(await page.evaluate(() => {
          const id = decodeURIComponent(location.hash.slice(1));
          return document.getElementById(id)?.id ?? document.querySelector(`a[name="${id}"]`)?.getAttribute('name');
        }), `user-content-named-${name}`);
      }
      const ids = await page.locator('article [id], article a[name]').evaluateAll(nodes => nodes.flatMap(node => [node.id, node.getAttribute('name')].filter(Boolean)));
      assert.equal(new Set(ids).size, ids.length);
      assert.equal(await page.locator('table > span, thead > span, tbody > span, tr > span, ul > span, ol > span').count(), 0);
      assert.equal(await page.locator('article table > thead > tr > th').count(), 2);
      assert.equal(await page.locator('.katex').count(), 3);
      assert.equal(await page.locator('script, [src^="javascript:"]').count(), 0);
      assert.deepEqual(requests, []);
    });
  }
});

test('raw allocations cannot shadow trusted TOC headings or duplicate another raw ID/name', async () => {
  const md = `<a id="x" name="other"></a>
<a id="x"></a>
<a id="x-1" name="other"></a>
<h2 id="raw-heading">Raw heading</h2>

## user-content-x

[Raw](#x) [Prefixed raw](#user-content-x-1) [Other](#other) [Raw heading](#raw-heading) [Trusted](#user-content-x)
`;
  const html = render(md);
  assert.equal(render(md), html, 'allocation is deterministic across SSR renders');
  await parseInBrowser(html, async (page, requests) => {
    assert.equal(await page.locator('[id="user-content-x"]').count(), 1);
    assert.equal(await page.evaluate(() => document.getElementById('user-content-x')?.tagName), 'H2');
    assert.equal(await page.locator('h2[id="user-content-x"]').innerText(), 'user-content-x');
    const targets = await page.locator('article [id], article [name]').evaluateAll(nodes => nodes.flatMap(node => [node.id, node.getAttribute('name')].filter(Boolean)));
    assert.equal(new Set(targets).size, targets.length, 'all allocated IDs/names are unique');
    assert.equal(await page.getByRole('link', { name: 'Raw', exact: true }).getAttribute('href'), '#user-content-x-1');
    assert.equal(await page.getByRole('link', { name: 'Trusted', exact: true }).getAttribute('href'), '#user-content-x');
    for (const label of ['Raw', 'Prefixed raw', 'Other', 'Raw heading', 'Trusted']) {
      await page.getByRole('link', { name: label, exact: true }).click();
      assert.ok(await page.evaluate(() => { const id = decodeURIComponent(location.hash.slice(1)); return document.getElementById(id) || document.getElementsByName(id)[0]; }));
    }
    assert.equal(await page.locator('[data-proposal-toc-id="user-content-x"]').first().getAttribute('href'), '#user-content-x');
    assert.deepEqual(requests, []);
  });
});

test('shared target contract covers overridden block, inline, table, list, image and code branches', async () => {
  const md = `<p id="p"><em id="em">em</em><del id="del">del</del></p>
<blockquote id="quote">quote</blockquote>
<hr id="rule">
<ul id="ul"><li id="li">list</li></ul>
<ol id="ol"><li>ordered</li></ol>
<table id="table"><thead id="head"><tr id="row"><th id="th">header</th></tr></thead><tbody id="body"><tr><td id="td">cell</td></tr></tbody></table>
<pre id="pre"><code id="block">one\ntwo\n</code></pre>
<img id="image" src="/safe.png" alt="safe">
<img id="omitted" src="javascript:alert(1)">
<a id="external" href="https://example.org">external</a>
<a id="fragment" href="#p">fragment</a>
<span id="plain">default renderer</span>
`;
  const expected = { p: 'P', em: 'EM', del: 'DEL', quote: 'BLOCKQUOTE', rule: 'HR', ul: 'UL', li: 'LI', ol: 'OL', table: 'DIV', head: 'THEAD', row: 'TR', th: 'TH', body: 'TBODY', td: 'TD', pre: 'DIV', block: 'DIV', image: 'IMG', omitted: 'SPAN', external: 'A', fragment: 'A', plain: 'SPAN' };
  await parseInBrowser(render(md), async page => {
    for (const [id, tag] of Object.entries(expected)) {
      const target = page.locator(`[id="user-content-${id}"]`);
      assert.equal(await target.count(), 1, id);
      assert.equal(await target.evaluate(node => node.tagName), tag, id);
    }
    assert.equal(await page.locator('table > thead > tr > th').innerText(), 'header');
    assert.equal(await page.locator('table > tbody > tr > td').innerText(), 'cell');
    assert.equal(await page.locator('ul > li').innerText(), 'list');
    assert.equal(await page.locator('#user-content-block code').innerText(), 'one\ntwo');
    assert.equal(await page.locator('#user-content-fragment').getAttribute('href'), '#user-content-p');
    assert.equal(await page.locator('[src^="javascript:"], script').count(), 0);
  });
});

test('sanitized math target IDs survive the trusted KaTeX replacement', async () => {
  await parseInBrowser(render('<code id="math-target" class="math-inline">x^2</code>\n\n<pre id="math-pre"><code id="math-code" class="language-math">y^2</code></pre>\n\n<span id="math-span" class="math-inline">z^2</span>\n\n[Jump](#math-target)'), async (page, requests) => {
    await page.getByRole('link', { name: 'Jump', exact: true }).click();
    for (const id of ['math-target', 'math-pre', 'math-code', 'math-span']) {
      assert.equal(await page.locator(`[id="user-content-${id}"]`).count(), 1);
    }
    assert.equal(await page.locator('.katex').count(), 3);
    assert.deepEqual(requests, []);
  });
});

const maliciousMarkdown = `
<script>window.__seoSecurityProbe=true</script>
<iframe src="https://attack.invalid/frame" srcdoc="<script>parent.__seoSecurityProbe=true</script>"></iframe>
<object data="https://attack.invalid/object"></object>
<embed src="https://attack.invalid/embed">
<svg onload="window.__seoSecurityProbe=true"><foreignObject><iframe src="https://attack.invalid/svg"></iframe></foreignObject></svg>
<math><annotation-xml encoding="text/html"><script>window.__seoSecurityProbe=true</script></annotation-xml></math>
<style>@import url(https://attack.invalid/style);</style>
<link rel="stylesheet" href="https://attack.invalid/link">
<meta http-equiv="refresh" content="0;url=https://attack.invalid/meta">
<form action="https://attack.invalid/form"><input autofocus onfocus="window.__seoSecurityProbe=true"></form>
<img src="javascript:alert(1)" onerror="window.__seoSecurityProbe=true">
<img src="data:image/svg+xml;base64,PHN2Zy8+">
<a href="jav&#x61;script:alert(1)" onclick="window.__seoSecurityProbe=true">bad</a>
<a href="data:text/html,attack">data</a>
<div style="background:url(https://attack.invalid/css)" onmouseover="window.__seoSecurityProbe=true">text</div>
`;

test('actual Markdown SSR excludes active upstream HTML and unsafe URLs', () => {
  const html = render(maliciousMarkdown);
  assert.doesNotMatch(html, /<(script|iframe|object|embed|svg|math|style(?! data-emotion=)|link|meta|form)\b/i);
  assert.doesNotMatch(html, /\s(on\w+|srcdoc|autofocus)=/i);
  assert.doesNotMatch(html, /(?:javascript:|data:text\/html|data:image\/svg|attack\.invalid)/i);
});

for (const [kind, number, directory, index] of [
  ['eip', '2', 'EIPs/EIPS', validEIPs],
  ['rip', '7993', 'RIPs/RIPS', validRIPs],
  ['caip', '104', 'CAIPs/CAIPs', validCAIPs],
] as const) {
  test(`${kind}-${number}: real indexed body leaves only the reader title H1 and retains TOC anchors`, () => {
    assert.ok(index[number], 'fixture must be indexed');
    const md = readFileSync(`submodules/${directory}/${kind}-${number}.md`, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
    const html = render(md);
    const page = `<h1>${kind.toUpperCase()}-${number}: ${index[number].title}</h1>${html}`;
    assert.equal((page.match(/<h1\b/g) ?? []).length, 1, 'only indexed reader title may be H1');
    const ids = Array.from(html.matchAll(/<h[2-6]\b[^>]*id="([^"]+)"/g)).map(match => match[1]);
    const links = Array.from(html.matchAll(/data-proposal-toc-id="([^"]+)"/g)).map(match => match[1]);
    assert.ok(links.length > 0);
    for (const id of links) assert.ok(ids.includes(id), `TOC ${id} must target a body heading`);
    for (const line of md.split('\n').filter(line => /^# /.test(line))) {
      const slug = line.slice(2).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      assert.ok(ids.includes(slug), `existing anchor ${slug} retained`);
      assert.match(html, new RegExp(`<h2\\b[^>]*id="${slug}"`), 'source H1 becomes article H2');
      assert.ok(links.includes(slug), `top-level section ${slug} included in TOC`);
    }
    if (kind === 'eip') assert.match(html, /from ethereum import tester/);
  });
}
