export type PRState = "open" | "closed" | "merged";
export function proposalLifecycleLabel(state?: PRState) {
  return state === "closed" ? "PR closed (unmerged)" : state ? `PR ${state}` : undefined;
}
export interface ProposalSource {
  title?: string;
  markdownPath: string;
  prNo?: number;
  prState?: PRState;
  prHeadSha?: string;
  isERC?: boolean;
}

// The upstream pull ref survives deletion of the contributor branch and tracks
// updates while a PR is active. Never guess an official file from its number.
export function preservedProposalSource(kind: ProposalKind, proposal: ProposalSource): ProposalSource {
  if (!proposal.prNo) return proposal;
  const { file } = githubSource(proposal.markdownPath);
  const upstream = kind === "caip" ? "ChainAgnostic/CAIPs" : `ethereum/${kind === "rip" ? "RIPs" : proposal.isERC ? "ERCs" : "EIPs"}`;
  const ref = proposal.prState === "merged" ? (kind === "caip" ? "main" : "master")
    : proposal.prState === "closed" && /^[a-f0-9]{40}$/.test(proposal.prHeadSha ?? "") ? proposal.prHeadSha
    : `refs/pull/${proposal.prNo}/head`;
  return { ...proposal, markdownPath: `https://raw.githubusercontent.com/${upstream}/${ref}/${file}` };
}

export function proposalSourceFromPR(kind: ProposalKind, proposal: ProposalSource, pr: { state: string; merged: boolean; head?: { sha: string } }): ProposalSource {
  const prState = pr.state === "closed" && pr.merged === true ? "merged"
    : pr.state === "closed" && pr.merged === false && /^[a-f0-9]{40}$/.test(pr.head?.sha ?? "") ? "closed"
    : pr.state === "open" && pr.merged === false ? "open" : undefined;
  if (!prState) throw new Error("Invalid PR lifecycle");
  return preservedProposalSource(kind, { ...proposal, prState, prHeadSha: prState === "closed" ? pr.head?.sha : undefined });
}

export async function resolveProposalSource(kind: ProposalKind, proposal: ProposalSource, fetcher: typeof fetch = fetch): Promise<ProposalSource> {
  if (!proposal.prNo) return proposal;
  const preserved = preservedProposalSource(kind, proposal);
  const { owner, repo } = githubSource(preserved.markdownPath);
  try {
    const response = await fetcher(`https://api.github.com/repos/${owner}/${repo}/pulls/${proposal.prNo}`, {
      cache: "no-store", signal: AbortSignal.timeout(4000), headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error("PR lifecycle unavailable");
    const source = proposalSourceFromPR(kind, proposal, await response.json());
    try {
      const files: PRFile[] = [];
      for (let page = 1; ; page++) {
        const response = await fetcher(`https://api.github.com/repos/${owner}/${repo}/pulls/${proposal.prNo}/files?per_page=100&page=${page}`, {
          cache: "no-store", signal: AbortSignal.timeout(4000), headers: { Accept: "application/vnd.github+json" },
        });
        if (!response.ok) throw new Error("PR files unavailable");
        const batch = await response.json();
        if (!Array.isArray(batch)) throw new Error("Invalid PR files");
        files.push(...batch);
        if (batch.length < 100) break;
        if (page >= 30) throw new Error("Incomplete PR files");
      }
      const reconciled = reconcilePRFile(source, files);
      const proven = hasPRFileEvidence(source, files);
      return source.prState === "merged" && proposal.prState !== "merged" && !proven
        ? { ...source, markdownPath: preserved.markdownPath } : reconciled;
    } catch {
      return source.prState === "merged" && proposal.prState !== "merged"
        ? { ...source, markdownPath: preserved.markdownPath } : source;
    }
  } catch {
    // A failed lifecycle request is not evidence of a merge or closure.
    return preserved;
  }
}

export interface PRFile { filename: string; status: string; previous_filename?: string; patch?: string }
export function hasPRFileEvidence(proposal: ProposalSource, files: PRFile[]): boolean {
  return reconcilePRFile(proposal, files) !== proposal || files.some(file =>
    file.filename === githubSource(proposal.markdownPath).file && ["added", "renamed"].includes(file.status));
}

export function reconcilePRFile(proposal: ProposalSource, files: PRFile[]): ProposalSource {
  const { file } = githubSource(proposal.markdownPath);
  if (files.some(candidate => candidate.filename === file && candidate.status !== "removed")) return proposal;
  const renamed = files.filter(candidate => candidate.status === "renamed" && candidate.previous_filename === file);
  const candidates = renamed.length ? renamed : files.filter(candidate => candidate.status === "added" && proposal.title &&
    candidate.patch?.split("\n").some(line => line === `+title: ${proposal.title}`));
  // Explicit rename lineage or a unique matching title in this exact PR only.
  // Never resolve ambiguous additions by proposal number alone.
  if (candidates.length !== 1 || !/^(EIPS|ERCS|RIPS|CAIPs)\/(eip|erc|rip|caip)-\d+\.md$/.test(candidates[0].filename) ||
    candidates[0].filename.split("/")[0] !== file.split("/")[0]) return proposal;
  return { ...proposal, markdownPath: proposal.markdownPath.slice(0, -file.length) + candidates[0].filename };
}

export function trackedPRNumbers(repo: string, open: number[], existing: Record<string, ProposalSource>): number[] {
  return Array.from(new Set([...open, ...Object.values(existing).filter(proposal => {
    try { return proposal.prNo && githubSource(proposal.markdownPath).repo === repo; }
    catch { return false; }
  }).map(proposal => proposal.prNo!)]));
}

export type ProposalKind = "eip" | "rip" | "caip";

export interface ProposalContent extends ProposalSource {
  markdown: string;
  markdownPath: string;
  isERC: boolean;
  source: "remote" | "bundled";
}

// Require proposal frontmatter, not just a successful HTTP status: proxies can
// return HTML error pages with a 200 response as well.
export function isProposalMarkdown(text: string, markdownPath?: string, requestedNumber?: string): boolean {
  const frontmatter = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  if (!frontmatter || !/^(?:eip|rip|caip):\s*\S+/m.test(frontmatter[1]) ||
    !/^title:\s*\S+/m.test(frontmatter[1]) || !text.slice(frontmatter[0].length).trim()) return false;
  if (!markdownPath) return true;
  const { file } = githubSource(markdownPath);
  const expected = file.match(/\/(eip|erc|rip|caip)-(\d+)\.md$/);
  const actual = frontmatter[1].match(/^(eip|rip|caip):\s*["']?(\d+)["']?\s*$/m);
  return !!expected && !!actual && actual[1] === (expected[1] === "erc" ? "eip" : expected[1]) &&
    actual[2].replace(/^0+(?=\d)/, "") === expected[2].replace(/^0+(?=\d)/, "") &&
    (requestedNumber === undefined || actual[2].replace(/^0+(?=\d)/, "") === requestedNumber.replace(/^0+(?=\d)/, ""));
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
      if (isProposalMarkdown(markdown, markdownPath)) return markdown;
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
  if (!isProposalMarkdown(data.markdown, data.markdownPath, number)) throw new Error("Invalid proposal content");
  return data;
}
