import { getProposalListMetadata } from "@/utils/proposalListMetadata";

export const metadata = getProposalListMetadata("caip");

export default function CAIPsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
