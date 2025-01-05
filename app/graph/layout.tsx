import { getMetadata } from "@/utils";

export const metadata = getMetadata({
  title: "EIP Dependency Graph | EIP.Tools",
  description:
    "Visualize dependecies between EIPs & ERCs with this interactive graph.",
  images: "https://eip.tools/og/graph.png",
});

const EIPGraphLayout = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export default EIPGraphLayout;
