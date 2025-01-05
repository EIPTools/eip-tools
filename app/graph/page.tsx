"use client";

import dynamic from "next/dynamic";

const EIPGraph = dynamic(() => import("@/components/EIPGraph"), {
  ssr: false,
});

export default function EIPGraphPage() {
  return <EIPGraph />;
}
