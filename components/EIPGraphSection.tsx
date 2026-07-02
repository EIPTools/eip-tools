"use client";

import { Box, Link, HStack } from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { FiShare2 } from "react-icons/fi";
import { EIPGraphWrapper } from "./EIPGraphWrapper";
import { SectionHeading } from "./SectionHeading";

export const EIPGraphSection = () => {
  return (
    <Box
      as="section"
      mt={10}
      px={{
        base: 4,
        md: 6,
        lg: 10,
      }}
    >
      <Box maxW="container.xl" mx="auto">
        <Link href="/graph" _hover={{ textDecoration: "none" }}>
          <HStack
            pb={4}
            align="center"
            color="text.primary"
            _hover={{ color: "primary.400" }}
          >
            <SectionHeading
              icon={FiShare2}
              rightElement={<ExternalLinkIcon fontSize="sm" />}
            >
              EIP dependency graph
            </SectionHeading>
          </HStack>
        </Link>
        <Box
          overflow="hidden"
          border="1px solid"
          borderColor="border.default"
          rounded="lg"
          bg="bg.subtle"
          h={{ base: "420px", md: "600px" }}
        >
          <EIPGraphWrapper isEmbedded={true} height={600} />
        </Box>
      </Box>
    </Box>
  );
};
