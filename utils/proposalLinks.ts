import { validCAIPs } from "@/data/validCAIPs";
import { validEIPs } from "@/data/validEIPs";
import { validRIPs } from "@/data/validRIPs";

type ProposalRoute = "eip" | "rip" | "caip";
type ProposalPrefix = ProposalRoute | "erc";

const routeByPrefix: Record<ProposalPrefix, ProposalRoute> = {
  eip: "eip",
  erc: "eip",
  rip: "rip",
  caip: "caip",
};

const proposalDataByRoute = {
  eip: validEIPs,
  rip: validRIPs,
  caip: validCAIPs,
};

const absoluteUrlPattern = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const proposalRoutePattern = /^(eip|rip|caip)$/i;
const proposalFilePattern = /^(eip|erc|rip|caip)-(\d+)\.md$/i;
const proposalSegmentPattern = /^(eip|erc|rip|caip)-(\d+)(?:\.md)?$/i;
const routeNumberPattern = /^(\d+)$/;

const stripLeadingZeros = (proposalNo: string) =>
  proposalNo.replace(/^0+(?=\d)/, "");

const getKnownProposalNo = (
  route: ProposalRoute,
  proposalNo: string
): string | undefined => {
  const proposals = proposalDataByRoute[route];

  if (Object.prototype.hasOwnProperty.call(proposals, proposalNo)) {
    return proposalNo;
  }

  const normalizedProposalNo = stripLeadingZeros(proposalNo);
  if (Object.prototype.hasOwnProperty.call(proposals, normalizedProposalNo)) {
    return normalizedProposalNo;
  }

  return undefined;
};

const parseRouteSegment = (
  segment: string,
  route: ProposalRoute
): { route: ProposalRoute; proposalNo: string } | undefined => {
  const routeNumberMatch = segment.match(routeNumberPattern);
  if (routeNumberMatch) {
    return { route, proposalNo: routeNumberMatch[1] };
  }

  const proposalSegmentMatch = segment.match(proposalSegmentPattern);
  if (!proposalSegmentMatch) {
    return undefined;
  }

  const prefix = proposalSegmentMatch[1].toLowerCase() as ProposalPrefix;
  const proposalRoute = routeByPrefix[prefix];

  if (proposalRoute !== route) {
    return undefined;
  }

  return { route, proposalNo: proposalSegmentMatch[2] };
};

const parseMarkdownFileSegment = (
  segment: string,
  allowExtensionlessProposal: boolean
): { route: ProposalRoute; proposalNo: string } | undefined => {
  const fileMatch = segment.match(proposalFilePattern);
  if (fileMatch) {
    const prefix = fileMatch[1].toLowerCase() as ProposalPrefix;
    return {
      route: routeByPrefix[prefix],
      proposalNo: fileMatch[2],
    };
  }

  if (!allowExtensionlessProposal) {
    return undefined;
  }

  const proposalSegmentMatch = segment.match(proposalSegmentPattern);
  if (!proposalSegmentMatch) {
    return undefined;
  }

  const prefix = proposalSegmentMatch[1].toLowerCase() as ProposalPrefix;
  return {
    route: routeByPrefix[prefix],
    proposalNo: proposalSegmentMatch[2],
  };
};

export const getCanonicalProposalHref = (
  href: string
): string | undefined => {
  const trimmedHref = href.trim();
  if (!trimmedHref || trimmedHref.startsWith("#")) {
    return undefined;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedHref, "https://eip.tools/");
  } catch {
    return undefined;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(parsedUrl.pathname).replace(/\/+$/, "");
  } catch {
    return undefined;
  }
  const pathSegments = pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];
  const parentSegment = pathSegments[pathSegments.length - 2]?.toLowerCase();

  if (!lastSegment) {
    return undefined;
  }

  const isAbsoluteUrl = absoluteUrlPattern.test(trimmedHref);
  const routeMatch = parentSegment?.match(proposalRoutePattern);
  const routeCandidate = routeMatch
    ? parseRouteSegment(lastSegment, routeMatch[1].toLowerCase() as ProposalRoute)
    : undefined;

  const isSpecDirectory =
    parentSegment === "eips" ||
    parentSegment === "ercs" ||
    parentSegment === "rips" ||
    parentSegment === "caips";
  const fileCandidate =
    routeCandidate ??
    parseMarkdownFileSegment(lastSegment, !isAbsoluteUrl || isSpecDirectory);

  if (!fileCandidate) {
    return undefined;
  }

  const knownProposalNo = getKnownProposalNo(
    fileCandidate.route,
    fileCandidate.proposalNo
  );

  if (!knownProposalNo) {
    return undefined;
  }

  return `/${fileCandidate.route}/${knownProposalNo}${parsedUrl.hash}`;
};
