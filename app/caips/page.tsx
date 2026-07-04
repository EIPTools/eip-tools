import { ProposalListPage } from "@/components/ProposalListPage";
import { validCAIPs } from "@/data/validCAIPs";
import { getProposalListItems } from "@/utils/proposals";

export default function CAIPsPage() {
  const items = getProposalListItems(validCAIPs, "caip");

  return (
    <ProposalListPage
      title="All CAIPs"
      description="Chain Agnostic Improvement Proposals"
      items={items}
    />
  );
}
