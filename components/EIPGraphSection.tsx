"use client";

import { Box, Heading, Link, HStack, Text } from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { EIPGraphWrapper } from "./EIPGraphWrapper";

export const EIPGraphSection = () => {
  return (
    <Box
      mt={10}
      px={{
        base: 0,
        md: 10,
      }}
    >
      <Link href="/graph">
        <Heading
          pb={4}
          px={{
            base: 4,
            md: 0,
          }}
        >
          <HStack>
            <Text>🕸️ EIPs dependency graph</Text>
            <ExternalLinkIcon fontSize={"md"} />
          </HStack>
        </Heading>
      </Link>
      <EIPGraphWrapper isEmbedded={true} height={600} />
    </Box>
  );
};
