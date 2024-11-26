import { Layout } from "@/components/Layout";

export default function SharedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
