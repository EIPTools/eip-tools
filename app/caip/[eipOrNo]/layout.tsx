import { getProposalContent, requireProposalReader } from "@/utils/proposalContent.server";
import { Layout } from "@/components/Layout";
import {
  convertMetadataToJson,
  extractMetadata,
  getMetadata,
  getBaseUrl,
} from "@/utils";

export async function generateMetadata({
  params: { eipOrNo },
}: {
  params: { eipOrNo: string };
}) {
  const { number: eipNo, proposal: validEIPData } = requireProposalReader("caip", eipOrNo);

  const content = await getProposalContent("caip", eipNo).catch(() => null);
  const eipMarkdownRes = content?.markdown ?? "";
  const { metadata } = extractMetadata(eipMarkdownRes);
  const metadataJson = convertMetadataToJson(metadata);

  const imageUrl = `${getBaseUrl()}/api/og?eipNo=${eipNo}&type=CAIP`;
  const postUrl = `${getBaseUrl()}/api/frame/home`;

  const generated = getMetadata({
    title: `CAIP-${eipNo}: ${validEIPData.title} | EIP.tools`,
    pathname: `/caip/${eipNo.replace(/^0+(?=\d)/, "")}`,
    description: metadataJson.description || `CAIP-${eipNo}: ${validEIPData.title}. Read the proposal, its status and dependencies on EIP.tools.`,
    images: imageUrl,
  });

  return {
    ...generated,
    other: {
      "fc:frame": "vNext",
      "fc:frame:image": imageUrl,
      "fc:frame:post_url": postUrl,
      "fc:frame:input:text": "Enter EIP/ERC No",
      "fc:frame:button:1": "Search 🔎",
      "fc:frame:button:2": `📙 CAIP-${eipNo}`,
      "fc:frame:button:2:action": "link",
      "fc:frame:button:2:target": `${getBaseUrl()}/caip/${eipNo}`,
      "of:version": "vNext",
      "of:accepts:anonymous": "true",
      "of:image": imageUrl,
      "of:post_url": postUrl,
      "of:input:text": "Enter EIP/ERC No",
      "of:button:1": "Search 🔎",
      "of:button:2": `📙 CAIP-${eipNo}`,
      "of:button:2:action": "link",
      "of:button:2:target": `${getBaseUrl()}/caip/${eipNo}`,
    },
  };
}

export default function EIPLayout({ children, params }: { children: React.ReactNode; params: { eipOrNo: string } }) {
  requireProposalReader("caip", params.eipOrNo);
  return <Layout>{children}</Layout>;
}
