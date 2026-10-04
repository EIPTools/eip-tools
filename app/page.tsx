import type { Metadata } from "next";
import { PageHeading } from "@/components/PageHeading";
import { getBaseUrl, getMetadata } from "@/utils";
import { EIPOfTheDay } from "@/components/EIPOfTheDay";
import { Layout } from "@/components/Layout";
import { TrendingEIPs } from "@/components/TrendingEIPs";
import { UpcomingHardForkEIPs } from "@/components/UpcomingHardForkEIPs";
import { EIPGraphSection } from "@/components/EIPGraphSection";
import { ProposalDirectoryPills } from "@/components/ProposalDirectoryPills";

export async function generateMetadata(): Promise<Metadata> {
  const imageUrl = `${getBaseUrl()}/og/index.png`;
  const postUrl = `${getBaseUrl()}/api/frame/home`;

  const metadata = getMetadata({
    pathname: "/",
    title: "EIP.tools",
    description: "Explore all EIPs, ERCs, RIPs and CAIPs easily!",
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

export default function Home() {
  return (
    <Layout>
      <PageHeading title="Explore Ethereum and cross-chain proposals" description="Search and read EIPs, ERCs, RIPs and CAIPs, browse their status, and explore proposal dependencies." />
      <ProposalDirectoryPills />
      <TrendingEIPs />
      <UpcomingHardForkEIPs />
      <EIPGraphSection />
      <EIPOfTheDay />
    </Layout>
  );
}
