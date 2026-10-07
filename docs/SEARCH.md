# Proposal search on Railway

Meilisearch stores a searchable copy of proposal text. The checked-in proposal
indexes and Git submodule snapshots remain the source of truth. The search box combines immediate number/title matches with debounced full-text
section results. `/api/search` keeps the search-only key on the server and returns
plain-text excerpts and local section links. Full Markdown is parsed to inert text
before cropping around a match; keyword highlights render as React text nodes
and marks, never upstream HTML. Code identifiers and link labels are preserved.

## Deployment

- Project: [eip-tools-search](https://railway.com/project/5b39a167-4f16-444e-85be-ca19a158f1b6)
- Service: `meilisearch` (`fdd5cd2a-8309-4f53-ad91-934571c55d8b`)
- Environment: `production`
- Image: `getmeili/meilisearch:v1.54.3`
- Endpoint: `https://meilisearch-production-9c37.up.railway.app`
- Railway domain target port: `7700`
- Health check: `/health`
- Volume: `meilisearch-volume`, mounted at `/meili_data`
- Database: `/meili_data/data.ms` (use a subdirectory, not the volume root)
- Index: `proposal_sections`

Runtime variables:

```env
MEILI_ENV=production
MEILI_HTTP_ADDR=0.0.0.0:7700
MEILI_DB_PATH=/meili_data/data.ms
MEILI_NO_ANALYTICS=true
MEILI_MAX_INDEXING_MEMORY=512MiB
MEILI_MAX_INDEXING_THREADS=1
MEILI_MASTER_KEY=<secret>
```

The 512 MiB setting limits indexing memory, not total process memory. Measure
actual Railway memory usage before imposing a service RAM limit. Meilisearch
incurs Railway compute and storage charges even when proposals are unchanged.

## Credentials

The local `.env.meilisearch.local` file is ignored by Git and has owner-only
permissions. The sync command loads only this search-specific file, not the
app's `.env.local`. It contains:

```env
MEILISEARCH_HOST=https://meilisearch-production-9c37.up.railway.app
MEILISEARCH_INDEX=proposal_sections
MEILISEARCH_INDEXING_KEY=<scoped secret>
MEILISEARCH_SEARCH_KEY=<search-only key>
MEILI_MASTER_KEY=<administrative secret>
```

Use the search-only key for UI integration. It can search `proposal_sections`
but cannot index documents, update settings, inspect other indexes, or manage
keys. The sync key covers `proposal_sections` and `proposal_sections_staging_*`.
It requires index create/get/delete/swap, settings update, document add/get,
stats get, tasks get, and search permissions. Never expose the sync/master key
in browser code. The deployed sync key includes `documents.get` to retain the
last successfully indexed text during partial refreshes.

## Local website

Add `MEILISEARCH_HOST` and `MEILISEARCH_SEARCH_KEY` from the search-specific
credential file to the app's ignored `.env.local`. Do not use a `NEXT_PUBLIC_`
prefix or put indexing/master credentials in the app. Restart the dev server
after changing environment variables.

```sh
NEXT_PUBLIC_DEVELOPMENT=true pnpm dev --hostname 127.0.0.1 --port 4317
```

Open http://127.0.0.1:4317 and search for `BASE_FEE_MAX_CHANGE_DENOMINATOR`
to test a body-only match. Use arrow keys and Enter, or click a result, to open
the matching section. Exact number/title matches appear first.

## Indexing

From the repository root:

```sh
git submodule update --init --recursive
pnpm search:sync --dry-run --allow-partial
pnpm search:sync
```

Provide `GITHUB_TOKEN` in the process environment for PR lifecycle and file
resolution. It is sent only to `api.github.com`. Canonical text comes from the
snapshots, falling back to the official URL if a file is absent. PR text uses
the existing preserved-source and lifecycle resolver. Every source must pass
the reader's file/frontmatter/number validation. Padded aliases are deduplicated
according to the reader's numeric identity; EIPs and ERCs share reader routes.

All headings and body text, including code and mathematical notation, are
indexed. Search sections use the same heading slugger as the reader. Large
sections are split into bounded parts linked to the same heading. Searchable
field priority is label, title, section, body. Results are deduplicated by
proposal ID and can be filtered by type, status, PR state, and proposal ID.

The default command aborts on incomplete source coverage before modifying the
live index. The first upload used `--allow-partial` after reviewing the source
report: 1,575 of 1,615 reader identities and 28,945 sections were available.
Forty entries had unavailable sources or a source number that no longer matched
the reader identity. See `.search/coverage.json` for exact IDs, URLs, and reasons.
This is an initial snapshot, not a claim that every indexed reader is searchable.

With `--allow-partial`, later refreshes retry all sources and retain the last
successful indexed text for sources that fail. Sources unavailable since the
initial upload remain omitted until they recover. Deleted proposal identities
are removed. Coverage reports distinguish fresh, retained, and omitted proposals.

Uploads go to a staging index. The command waits for asynchronous tasks,
validates document count, swaps the finished index into place, and removes the
old staging index. Failure before the swap leaves live search intact.

## Search requests

Send `POST /indexes/proposal_sections/search` with the search-only key and a
body such as:

```json
{
  "q": "DELEGATECALL",
  "matchingStrategy": "all",
  "limit": 20,
  "attributesToRetrieve": ["label", "title", "section", "url", "type", "status", "body"],
  "attributesToCrop": ["body"],
  "cropLength": 40,
  "attributesToHighlight": ["title", "section", "body"]
}
```

Use `_formatted.body` for the cropped excerpt; discard the raw `body` before
returning results from an app search endpoint. Highlighted results contain upstream text. Render the text safely; do not insert
raw HTML from Meilisearch into the app. Keep exact proposal-number navigation
ahead of body matches and debounce search requests when wiring the UI.

## Automated refresh

`.github/workflows/sync-proposal-search.yml` follows successful runs of the
existing `Update EIP Data` workflow and supports manual dispatch. It checks out
the latest `master` with submodules and saves coverage reports as artifacts.
It runs only in `apoorvlathey/eip-tools-vercel`, matching the existing updater.

Activation requires publishing the workflow and configuring that repository:

- Actions variable `MEILISEARCH_HOST`: the endpoint above.
- Actions secret `MEILISEARCH_INDEXING_KEY`: the scoped sync key.

The approved scoped indexing key is stored in this repository's Actions secrets,
and the endpoint is configured as an Actions variable. The workflow follows
successful proposal updates and can also be dispatched manually.

## Verification and maintenance

```sh
pnpm test:search
pnpm test:markdown
pnpm exec tsc --noEmit
pnpm lint
```

Check live queries for proposal identifiers, obscure body terms, opcodes,
Solidity identifiers, and type/status filters. Test that the search-only key
cannot write and unauthenticated searches are rejected. Railway `/health` is
public by design and does not prove the index is populated.

Initial acceptance verified 28,945 documents survived a Railway redeploy,
body-only Solidity identifier searches, combined type/status filters, highlighted
excerpts, and search-key authorization. The first queries after restart took
several seconds while disk pages warmed. Warm identifier queries reached
1–2 ms; other first-time term queries took tens to hundreds of milliseconds.
Client network latency is additional. Strict
`matchingStrategy: "all"` avoids returning weaker partial-term matches for
technical identifiers.

Keep the image pinned. Before a Meilisearch version upgrade, take a dump or a
Railway volume backup and follow the version's migration instructions. The index
can be rebuilt from source snapshots, but PR sources may become unavailable,
so keep a backup to preserve their last successfully indexed text.
