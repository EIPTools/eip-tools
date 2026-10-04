import { getMetadata } from "@/utils";

export const metadata = getMetadata({
  pathname: "/graph",
  title: "EIP Dependency Graph | EIP.Tools",
  description:
    "Visualize dependencies between EIPs & ERCs with this interactive graph.",
  images: "https://eip.tools/og/graph.png",
});

const EIPGraphLayout = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export default EIPGraphLayout;
