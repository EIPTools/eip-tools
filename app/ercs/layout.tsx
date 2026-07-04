import { getProposalListMetadata } from "@/utils/proposalListMetadata";

export const metadata = getProposalListMetadata("erc");

export default function ERCsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
