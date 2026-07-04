import { getProposalListMetadata } from "@/utils/proposalListMetadata";

export const metadata = getProposalListMetadata("rip");

export default function RIPsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
