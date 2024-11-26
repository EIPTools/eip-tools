import { Metadata } from "next";
import { getMetadata } from "@/utils";
import { Layout } from "@/components/Layout";

export async function generateMetadata(): Promise<Metadata> {
  const imageUrl = `${process.env["HOST"]}/og/index.png?date=${Date.now()}`;
  const postUrl = `${process.env["HOST"]}/api/frame/home`;

  const metadata = getMetadata({
    title: "Shared Bookmarks - EIP.tools",
    description: "Explore the EIPs, ERCs, RIPs and CAIPs shared with you!",
    images: imageUrl,
  });

  return {
    ...metadata,
    other: {
      "fc:frame": "vNext",
      "fc:frame:image": imageUrl,
      "fc:frame:post_url": postUrl,
      "fc:frame:input:text": "Enter EIP/ERC No",
      "fc:frame:button:1": "Search 🔎",
      "of:version": "vNext",
      "of:accepts:anonymous": "true",
      "of:image": imageUrl,
      "of:post_url": postUrl,
      "of:input:text": "Enter EIP/ERC No",
      "of:button:1": "Search 🔎",
    },
  };
}

export default function SharedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
