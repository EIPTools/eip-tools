"use client";

import dynamic from "next/dynamic";
import { EIPGraphErrorBoundary } from "./EIPGraphErrorBoundary";

// Dynamically import EIPGraph with ssr disabled
const EIPGraph = dynamic(() => import("./EIPGraph"), {
  ssr: false,
});

export const EIPGraphWrapper = ({
  isEmbedded = false,
  height,
  width,
}: {
  isEmbedded?: boolean;
  height?: number;
  width?: number;
}) => {
  return (
    <EIPGraphErrorBoundary isEmbedded={isEmbedded}>
      <EIPGraph isEmbedded={isEmbedded} height={height} width={width} />
    </EIPGraphErrorBoundary>
  );
};
