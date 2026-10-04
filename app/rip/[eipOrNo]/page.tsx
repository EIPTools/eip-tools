import Reader from "./reader";
import { extractEipNumber } from "@/utils";
import { getProposalContent } from "@/utils/proposalContent.server";

export default async function ProposalPage({ params }: { params: { eipOrNo: string } }) {
  const number = extractEipNumber(params.eipOrNo, "rip");
  const initialContent = await getProposalContent("rip", number).catch(() => undefined);
  return <Reader key={number} params={params} initialContent={initialContent} />;
}
