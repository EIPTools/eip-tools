import Reader from "./reader";
import { getProposalContent, requireProposalReader } from "@/utils/proposalContent.server";

export default async function ProposalPage({ params }: { params: { eipOrNo: string } }) {
  const { number } = requireProposalReader("caip", params.eipOrNo);
  const initialContent = await getProposalContent("caip", number).catch(() => undefined);
  return <Reader key={number} params={params} initialContent={initialContent} />;
}
