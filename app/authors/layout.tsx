import { getMetadata } from "@/utils";

export const metadata = getMetadata({
  title: "Authors | EIP.Tools",
  description:
    "Browse all EIP, ERC, RIP and CAIP authors — see proposal counts, GitHub profiles, and Twitter handles.",
  images: "https://eip.tools/og/index.png",
});

const AuthorsLayout = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export default AuthorsLayout;
