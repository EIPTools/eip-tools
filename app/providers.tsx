"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { CacheProvider } from "@chakra-ui/next-js";
import NextTopLoader from "nextjs-toploader";
import theme from "@/style/theme";
import "@fortawesome/fontawesome-svg-core/styles.css";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <CacheProvider>
      <ChakraProvider theme={theme}>
        <NextTopLoader color="#3B82F6" showSpinner={false} />
        {children}
      </ChakraProvider>
    </CacheProvider>
  );
};
