import { ProposalListPage } from "@/components/ProposalListPage";
import { validRIPs } from "@/data/validRIPs";
import { getProposalListItems } from "@/utils/proposals";

export default function RIPsPage() {
  const items = getProposalListItems(validRIPs, "rip");

  return (
    <ProposalListPage
      title="All RIPs"
      description="Rollup Improvement Proposals"
      items={items}
    />
  );
}
