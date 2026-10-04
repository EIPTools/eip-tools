import { getProposalContent } from "@/utils/proposalContent.server";
import { Layout } from "@/components/Layout";
import {
  convertMetadataToJson,
  extractEipNumber,
  extractMetadata,
  getMetadata,
  getBaseUrl,
} from "@/utils";
import { validEIPs } from "@/data/validEIPs";
import { getProposalDetails } from "@/utils/proposals";

export async function generateMetadata({
  params: { eipOrNo },
}: {
  params: { eipOrNo: string };
}) {
  const eipNo = extractEipNumber(eipOrNo, "eip");
  const validEIPData = getProposalDetails(validEIPs, eipNo);

  if (!validEIPData) {
    return;
  }

  const content = await getProposalContent("eip", eipNo).catch(() => null);
  const eipMarkdownRes = content?.markdown ?? "";
  const { metadata } = extractMetadata(eipMarkdownRes);
  const metadataJson = convertMetadataToJson(metadata);

  const imageUrl = `${getBaseUrl()}/api/og?eipNo=${eipNo}`;
  const postUrl = `${getBaseUrl()}/api/frame/home`;

  const generated = getMetadata({
    title: `${validEIPData.isERC ? "ERC" : "EIP"}-${eipNo}: ${
      validEIPData.title
    } | EIP.tools`,
    pathname: `/eip/${eipNo.replace(/^0+(?=\d)/, "")}`,
    description: metadataJson.description || `${validEIPData.isERC ? "ERC" : "EIP"}-${eipNo}: ${validEIPData.title}. Read the proposal, its status and dependencies on EIP.tools.`,
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
      "fc:frame:button:2": `📙 ${validEIPData.isERC ? "ERC" : "EIP"}-${eipNo}`,
      "fc:frame:button:2:action": "link",
      "fc:frame:button:2:target": `${getBaseUrl()}/eip/${eipNo}`,
      "of:version": "vNext",
      "of:accepts:anonymous": "true",
      "of:image": imageUrl,
      "of:post_url": postUrl,
      "of:input:text": "Enter EIP/ERC No",
      "of:button:1": "Search 🔎",
      "of:button:2": `📙 ${validEIPData.isERC ? "ERC" : "EIP"}-${eipNo}`,
      "of:button:2:action": "link",
      "of:button:2:target": `${getBaseUrl()}/eip/${eipNo}`,
    },
  };
}

export default function EIPLayout({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}
