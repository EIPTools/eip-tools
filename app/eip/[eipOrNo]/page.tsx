import Reader from "./reader";
import { getProposalContent, requireProposalReader } from "@/utils/proposalContent.server";

export default async function EIPPage({ params }: { params: { eipOrNo: string } }) {
  const { number } = requireProposalReader("eip", params.eipOrNo);
  // Uses the same validated remote cache and bundled outage fallback as the API.
  // On total failure the client retains its existing retry flow.
  const initialContent = await getProposalContent("eip", number).catch(() => undefined);
  return <Reader key={number} params={params} initialContent={initialContent} />;
}
