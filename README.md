# eip.tools

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
