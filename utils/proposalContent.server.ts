import { readFile } from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { validEIPs } from "@/data/validEIPs";
import { validRIPs } from "@/data/validRIPs";
import { validCAIPs } from "@/data/validCAIPs";
import { getProposalDetails } from "@/utils/proposals";
import { fetchRemoteMarkdown, githubSource, isProposalMarkdown, type ProposalContent, type ProposalKind } from "./proposalContent";

// Cache only validated successes. Throwing on refresh failure preserves Next's
// last successful value; bundled fallbacks never replace fresher cached content.
const cachedRemoteMarkdown = unstable_cache(fetchRemoteMarkdown, ["proposal-markdown-v1"], { revalidate: 300 });
const pending = new Map<string, Promise<string>>();

async function remoteMarkdown(url: string) {
  let request = pending.get(url);
  if (!request) {
    request = cachedRemoteMarkdown(url).finally(() => pending.delete(url));
    pending.set(url, request);
  }
  return request;
}

export async function readBundledMarkdown(url: string) {
  const { owner, repo, ref, file } = githubSource(url);
  const official = owner === "ethereum" && ["EIPs", "ERCs", "RIPs"].includes(repo) && ref === "master";
  const caip = owner === "ChainAgnostic" && repo === "CAIPs" && ref === "main";
  if (!official && !caip) throw new Error("No matching bundled source");
  // Never substitute a canonical proposal for a fork/PR with the same number.
  const filename = path.basename(file);
  const markdown = await (repo === "EIPs"
    ? readFile(path.join(process.cwd(), "submodules/EIPs/EIPS", filename), "utf8")
    : repo === "ERCs"
    ? readFile(path.join(process.cwd(), "submodules/ERCs/ERCS", filename), "utf8")
    : repo === "RIPs"
    ? readFile(path.join(process.cwd(), "submodules/RIPs/RIPS", filename), "utf8")
    : readFile(path.join(process.cwd(), "submodules/CAIPs/CAIPs", filename), "utf8"));
  if (!isProposalMarkdown(markdown)) throw new Error("Invalid bundled proposal");
  return markdown;
}

export async function getProposalContent(kind: ProposalKind, number: string): Promise<ProposalContent> {
  if (!/^\d{1,12}$/.test(number)) throw new Error("Invalid proposal number");
  const index = kind === "rip" ? validRIPs : kind === "caip" ? validCAIPs : validEIPs;
  const proposal = getProposalDetails(index, number);
  const canonicalNumber = number.replace(/^0+(?=\d)/, "");
  const urls = proposal ? [proposal.markdownPath] : kind === "eip" ? [
    `https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-${canonicalNumber}.md`,
    `https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-${canonicalNumber}.md`,
  ] : [kind === "rip"
    ? `https://raw.githubusercontent.com/ethereum/RIPs/master/RIPS/rip-${canonicalNumber}.md`
    : `https://raw.githubusercontent.com/ChainAgnostic/CAIPs/main/CAIPs/caip-${canonicalNumber}.md`];

  for (const markdownPath of urls) {
    const isERC = proposal?.isERC ?? markdownPath.includes("/ERCS/");
    try {
      return { markdown: await remoteMarkdown(markdownPath), markdownPath, isERC, source: "remote" };
    } catch {
      try {
        return { markdown: await readBundledMarkdown(markdownPath), markdownPath, isERC, source: "bundled" };
      } catch {
        // Unknown EIP numbers can belong to either the ERC or EIP repository.
      }
    }
  }
  throw new Error("Proposal unavailable");
}
