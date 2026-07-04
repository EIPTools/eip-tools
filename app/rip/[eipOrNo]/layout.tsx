import { Layout } from "@/components/Layout";
import {
  convertMetadataToJson,
  extractEipNumber,
  extractMetadata,
  getMetadata,
} from "@/utils";
import { validRIPs } from "@/data/validRIPs";
import { getProposalDetails } from "@/utils/proposals";

export async function generateMetadata({
  params: { eipOrNo },
}: {
  params: { eipOrNo: string };
}) {
  const eipNo = extractEipNumber(eipOrNo, "rip");
  const validEIPData = getProposalDetails(validRIPs, eipNo);

  if (!validEIPData) {
    return;
  }

  const eipMarkdownRes = await fetch(validEIPData.markdownPath).then(
    (response) => response.text()
  );
  const { metadata } = extractMetadata(eipMarkdownRes);
  const metadataJson = convertMetadataToJson(metadata);

  const imageUrl = `${process.env["HOST"]}/api/og?eipNo=${eipNo}&type=RIP`;
  const postUrl = `${process.env["HOST"]}/api/frame/home`;

  const generated = getMetadata({
    title: `RIP-${eipNo}: ${validEIPData.title} | EIP.tools`,
    description: metadataJson.description,
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
      "fc:frame:button:2:target": `${process.env["HOST"]}/eip/${eipNo}`,
      "of:version": "vNext",
      "of:accepts:anonymous": "true",
      "of:image": imageUrl,
      "of:post_url": postUrl,
      "of:input:text": "Enter EIP/ERC No",
      "of:button:1": "Search 🔎",
      "of:button:2": `📙 ${validEIPData.isERC ? "ERC" : "EIP"}-${eipNo}`,
      "of:button:2:action": "link",
      "of:button:2:target": `${process.env["HOST"]}/eip/${eipNo}`,
    },
  };
}

export default function EIPLayout({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}
