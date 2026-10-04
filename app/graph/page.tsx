"use client";

import { PageHeading } from "@/components/PageHeading";
import { EIPGraphWrapper } from "@/components/EIPGraphWrapper";

export default function EIPGraphPage() {
  return <><PageHeading title="EIP Dependency Graph" description="Explore dependencies between EIPs and ERCs. Search a proposal and select a node to read it." /><EIPGraphWrapper /></>;
}
