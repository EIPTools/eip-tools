import Reader from "./reader";
import { extractEipNumber } from "@/utils";
import { getProposalContent } from "@/utils/proposalContent.server";

export default async function EIPPage({ params }: { params: { eipOrNo: string } }) {
  const number = extractEipNumber(params.eipOrNo, "eip");
  // Uses the same validated remote cache and bundled outage fallback as the API.
  // On total failure the client retains its existing retry flow.
  const initialContent = await getProposalContent("eip", number).catch(() => undefined);
  return <Reader key={number} params={params} initialContent={initialContent} />;
}
