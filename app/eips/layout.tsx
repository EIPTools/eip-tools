import { getProposalListMetadata } from "@/utils/proposalListMetadata";

export const metadata = getProposalListMetadata("eip");

export default function EIPsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
