# Authors Data Pipeline

## Scripts (run in order)

### 1. Extract authors from proposal markdowns

```bash
npx tsx scripts/extractAuthors.ts
```

Reads all EIP/ERC/RIP/CAIP markdown files from submodules, extracts `(@handle)` patterns and email addresses from author fields, counts frequency, and writes `data/authors/authors.json`.

### 2. Verify GitHub profiles and fetch Twitter handles

```bash
npx tsx scripts/verifyGithubAuthors.ts
```

For each `@handle` author, calls the GitHub API to verify the profile exists. If not found, removes the `github` URL. Also fetches the `twitter_username` from GitHub profiles and sets the `twitter` URL. Requires `gh` CLI to be authenticated (`gh auth login`).

Updates `data/authors/authors.json` in place.

## Manual files

- **`custom-authors.json`** — Alias mappings (merge duplicate entries) and manual Twitter handle overrides. Applied at render time by the `/authors` page.
- **`milady-authors.json`** — List of author handles flagged as "Milady". Displayed on the `/authors` page with a filter toggle.
