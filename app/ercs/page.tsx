import { ProposalListPage } from "@/components/ProposalListPage";
import { validEIPs } from "@/data/validEIPs";
import { getProposalListItems } from "@/utils/proposals";

export default function ERCsPage() {
  const items = getProposalListItems(validEIPs, "erc");

  return (
    <ProposalListPage
      title="All ERCs"
      description="Ethereum Request for Comments"
      items={items}
    />
  );
}
