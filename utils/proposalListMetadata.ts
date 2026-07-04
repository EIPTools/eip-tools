import type { Metadata } from "next";
import { getBaseUrl, getMetadata } from "@/utils";
import type { ProposalListKind } from "@/utils/proposals";

interface ProposalListMetadata {
  title: string;
  heading: string;
  description: string;
  imagePath: string;
  accent: string;
}

export const proposalListMetadata: Record<
  ProposalListKind,
  ProposalListMetadata
> = {
  eip: {
    title: "All EIPs | EIP.tools",
    heading: "All EIPs",
    description: "Browse all Ethereum Improvement Proposals by proposal number.",
    imagePath: "eips/opengraph-image",
    accent: "#6ea8ff",
  },
  erc: {
    title: "All ERCs | EIP.tools",
    heading: "All ERCs",
    description:
      "Browse all Ethereum Request for Comments proposals by proposal number.",
    imagePath: "ercs/opengraph-image",
    accent: "#8bdb81",
  },
  rip: {
    title: "All RIPs | EIP.tools",
    heading: "All RIPs",
    description: "Browse all Rollup Improvement Proposals by proposal number.",
    imagePath: "rips/opengraph-image",
    accent: "#ffb86b",
  },
  caip: {
    title: "All CAIPs | EIP.tools",
    heading: "All CAIPs",
    description:
      "Browse all Chain Agnostic Improvement Proposals by proposal number.",
    imagePath: "caips/opengraph-image",
    accent: "#d2a8ff",
  },
};

export const getProposalListMetadata = (
  kind: ProposalListKind
): Metadata => {
  const config = proposalListMetadata[kind];

  return getMetadata({
    title: config.title,
    description: config.description,
    images: `${getBaseUrl()}/${config.imagePath}`,
  });
};
