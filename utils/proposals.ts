import type { ValidEIPs } from "@/types";

export type ProposalListKind = "eip" | "erc" | "rip" | "caip";

export interface ProposalListItem {
  number: string;
  label: string;
  href: string;
  title: string;
  status?: string;
  prNo?: number;
  prUrl?: string;
  timestamp?: string;
  markdownPath: string;
  requires?: string[];
}

const proposalFilePattern = /(?:^|\/)(?:eip|erc|rip|caip)-(\d+)\.md/i;

const stripLeadingZeros = (proposalNo: string) =>
  proposalNo.replace(/^0+(?=\d)/, "");

const getProposalNumber = (key: string, markdownPath: string) => {
  if (/^\d+$/.test(key)) {
    return key;
  }

  return markdownPath.match(proposalFilePattern)?.[1] ?? key;
};

const getProposalTimestamp = (timestamp?: string) => {
  if (!timestamp) {
    return 0;
  }

  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareProposalItems = (
  first: ProposalListItem,
  second: ProposalListItem
) => {
  const firstNumber = parseInt(first.number, 10);
  const secondNumber = parseInt(second.number, 10);

  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    const numberDelta = secondNumber - firstNumber;

    if (numberDelta !== 0) {
      return numberDelta;
    }
  }

  const timestampDelta =
    getProposalTimestamp(second.timestamp) -
    getProposalTimestamp(first.timestamp);

  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  return second.label.localeCompare(first.label);
};

const shouldIncludeProposal = (
  kind: ProposalListKind,
  proposal: ValidEIPs[string]
) => {
  if (kind === "erc") {
    return proposal.isERC === true;
  }

  if (kind === "eip") {
    return proposal.isERC !== true;
  }

  return true;
};

const getProposalPrefix = (kind: ProposalListKind) =>
  kind === "erc" ? "ERC" : kind.toUpperCase();

const getProposalRoute = (kind: ProposalListKind) =>
  kind === "rip" ? "rip" : kind === "caip" ? "caip" : "eip";

export const getProposalPrUrl = (
  kind: ProposalListKind,
  proposal: ValidEIPs[string]
) => {
  if (!proposal.prNo) {
    return undefined;
  }

  const repo =
    kind === "caip"
      ? "ChainAgnostic/CAIPs"
      : kind === "rip"
        ? "ethereum/RIPs"
        : proposal.isERC
          ? "ethereum/ERCs"
          : "ethereum/EIPs";

  return `https://github.com/${repo}/pull/${proposal.prNo}`;
};

export const getProposalDetails = (
  proposals: ValidEIPs,
  proposalNo: string
) => {
  const candidates = [
    proposalNo,
    stripLeadingZeros(proposalNo),
    String(parseInt(proposalNo, 10)),
  ];

  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(proposals, candidate)) {
      return proposals[candidate];
    }
  }

  return undefined;
};

export const getProposalListItems = (
  proposals: ValidEIPs,
  kind: ProposalListKind
) => {
  const prefix = getProposalPrefix(kind);
  const route = getProposalRoute(kind);
  const itemsByNumber = new Map<string, ProposalListItem>();

  for (const [key, proposal] of Object.entries(proposals)) {
    if (!shouldIncludeProposal(kind, proposal)) {
      continue;
    }

    const number = getProposalNumber(key, proposal.markdownPath);

    if (!/^\d+$/.test(number)) {
      continue;
    }

    const item: ProposalListItem = {
      number,
      label: `${prefix}-${number}`,
      href: `/${route}/${number}`,
      title: proposal.title,
      status: proposal.status,
      prNo: proposal.prNo,
      prUrl: getProposalPrUrl(kind, proposal),
      timestamp: proposal.timestamp,
      markdownPath: proposal.markdownPath,
      requires: proposal.requires,
    };
    const existing = itemsByNumber.get(number);

    if (!existing || compareProposalItems(item, existing) < 0) {
      itemsByNumber.set(number, item);
    }
  }

  return Array.from(itemsByNumber.values()).sort(compareProposalItems);
};

export const formatProposalDate = (timestamp?: string) => {
  if (!timestamp) {
    return "-";
  }

  const [date] = timestamp.split("T");
  return date || "-";
};
