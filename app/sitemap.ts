import type { MetadataRoute } from "next";
import { validEIPs } from "@/data/validEIPs";
import { validRIPs } from "@/data/validRIPs";
import { validCAIPs } from "@/data/validCAIPs";
import { getBaseUrl } from "@/utils";
import { getProposalListItems } from "@/utils/proposals";

/** Only public, indexed readers and directories; never API or bookmark state. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = new Set(["/", "/eips", "/ercs", "/rips", "/caips", "/graph", "/authors"]);
  const proposals = [
    ...getProposalListItems(validEIPs, "eip"),
    ...getProposalListItems(validEIPs, "erc"),
    ...getProposalListItems(validRIPs, "rip"),
    ...getProposalListItems(validCAIPs, "caip"),
  ];
  for (const proposal of proposals) {
    paths.add(proposal.href.replace(/\/(\d+)$/, (_, number: string) => `/${number.replace(/^0+(?=\d)/, "")}`));
  }
  // The indexes do not provide reliable content modification dates for every entry.
  return Array.from(paths).map(path => ({ url: new URL(path, getBaseUrl()).href }));
}
