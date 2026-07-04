import { ProposalListPage } from "@/components/ProposalListPage";
import { validEIPs } from "@/data/validEIPs";
import { getProposalListItems } from "@/utils/proposals";

export default function EIPsPage() {
  const items = getProposalListItems(validEIPs, "eip");

  return (
    <ProposalListPage
      title="All EIPs"
      description="Ethereum Improvement Proposals"
      items={items}
    />
  );
}
