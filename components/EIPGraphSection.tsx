"use client";

import { Box, Heading, Link, HStack, Text } from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { EIPGraph } from "@/components/EIPGraph";

export const EIPGraphSection = () => {
  return (
    <Box mt={10} px={10}>
      <Link href="/graph">
        <Heading pb={4}>
          <HStack>
            <Text>🕸️ EIPs dependency graph</Text>
            <ExternalLinkIcon fontSize={"md"} />
          </HStack>
        </Heading>
      </Link>
      <EIPGraph isEmbedded={true} height={600} />
    </Box>
  );
};
