export type ProposalKind = "eip" | "rip" | "caip";

export interface ProposalContent {
  markdown: string;
  markdownPath: string;
  isERC: boolean;
  source: "remote" | "bundled";
}

// Require proposal frontmatter, not just a successful HTTP status: proxies can
// return HTML error pages with a 200 response as well.
export function isProposalMarkdown(text: string): boolean {
  const frontmatter = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  return !!frontmatter && /^(?:eip|rip|caip):\s*\S+/m.test(frontmatter[1]) &&
    /^title:\s*\S+/m.test(frontmatter[1]) && text.slice(frontmatter[0].length).trim().length > 0;
}

export function githubSource(markdownPath: string) {
  const url = new URL(markdownPath);
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/(.+)\/((?:EIPS|ERCS|RIPS|CAIPs)\/[^/]+\.md)$/);
  if (url.protocol !== "https:" || url.hostname !== "raw.githubusercontent.com" || !match) {
    throw new Error("Unsupported proposal source");
  }
  const [, owner, repo, rawRef, file] = match;
  const ref = rawRef.replace(/^refs\/heads\//, "");
  return {
    owner, repo, ref, file,
    apiURL: `https://api.github.com/repos/${owner}/${repo}/contents/${file}?ref=${encodeURIComponent(ref)}`,
  };
}

export async function fetchRemoteMarkdown(markdownPath: string, fetcher: typeof fetch = fetch) {
  const { apiURL } = githubSource(markdownPath);
  for (const url of [markdownPath, apiURL]) {
    try {
      const response = await fetcher(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
        headers: { Accept: "application/vnd.github.raw+json" },
      });
      if (!response.ok) continue;
      const markdown = await response.text();
      if (isProposalMarkdown(markdown)) return markdown;
    } catch {
      // Try the independent GitHub API when the raw-file CDN fails or times out.
    }
  }
  throw new Error("Proposal sources unavailable");
}

export async function fetchProposalContent(kind: ProposalKind, number: string): Promise<ProposalContent> {
  const response = await fetch(`/api/proposals/${kind}/${encodeURIComponent(number)}`, {
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error("Proposal unavailable");
  const data: ProposalContent = await response.json();
  if (!isProposalMarkdown(data.markdown)) throw new Error("Invalid proposal content");
  return data;
}
