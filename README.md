# eip.tools

### Full-text search service

Meilisearch is hosted on Railway. See [docs/SEARCH.md](docs/SEARCH.md) for the
deployment, credentials, corpus coverage, indexing command, and sync workflow.
The existing search UI has not yet been connected to the service.

### Proposal content resilience

Readers fetch `/api/proposals/{eip|rip|caip}/{number}` instead of contacting
GitHub's raw CDN from the browser. The server validates proposal frontmatter,
tries GitHub's Contents API when the raw CDN fails (4-second timeout per source),
and caches successful Markdown for five minutes using Next's persistent Data
Cache. Failed revalidation preserves the last successful cached response.

On a cold-cache outage, official proposals fall back to the checked-in Git
submodules. Deployment checkouts must initialize them with
`git submodule update --init --recursive`; Next's output tracing includes their
Markdown in the server bundle. The build checks that all four snapshot directories
are populated. These copies are as recent as the submodule
commits in the deployment. PR/fork sources use their exact indexed URL and are
never replaced with an unrelated canonical proposal; if neither remote nor
cached content is available, the reader shows a retry action.

Run the outage regression checks with
`pnpm exec tsx --test scripts/proposalContent.test.ts`.

### SEO regression checks

`pnpm test` runs content and metadata unit regressions. With the local development
server running (`NEXT_PUBLIC_DEVELOPMENT=true pnpm dev --hostname 127.0.0.1 --port 4317`),
run `pnpm test:seo` for initial HTML and source-derived sitemap checks.
For isolated hydrated-browser checks, install and use Chromium locally:

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/node_modules/.cache/ms-playwright" pnpm exec playwright install chromium
PLAYWRIGHT_BROWSERS_PATH="$PWD/node_modules/.cache/ms-playwright" pnpm test:seo:browser
```

Set `SEO_TEST_ORIGIN` to test another local port. Browser tests require Node 20+.
Public metadata and sitemap URLs use `HOST` as the configured canonical origin,
defaulting to `https://eip.tools`; preview deployment hostnames are not canonicals.
See [SEO_REVIEW.md](SEO_REVIEW.md) for evidence, scope, and the credential-free
build blocker reproduced on the baseline.
