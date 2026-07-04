"use client";

import NLink from "next/link";
import {
  Badge,
  Box,
  Container,
  HStack,
  Icon,
  Link,
  Text,
} from "@chakra-ui/react";
import { FiBox, FiFileText, FiGitBranch, FiLayers } from "react-icons/fi";
import { validCAIPs } from "@/data/validCAIPs";
import { validEIPs } from "@/data/validEIPs";
import { validRIPs } from "@/data/validRIPs";
import { getProposalListItems } from "@/utils/proposals";

const directories = [
  {
    label: "EIPs",
    href: "/eips",
    count: getProposalListItems(validEIPs, "eip").length,
    icon: FiFileText,
  },
  {
    label: "ERCs",
    href: "/ercs",
    count: getProposalListItems(validEIPs, "erc").length,
    icon: FiLayers,
  },
  {
    label: "CAIPs",
    href: "/caips",
    count: getProposalListItems(validCAIPs, "caip").length,
    icon: FiBox,
  },
  {
    label: "RIPs",
    href: "/rips",
    count: getProposalListItems(validRIPs, "rip").length,
    icon: FiGitBranch,
  },
];

export const ProposalDirectoryPills = () => {
  return (
    <Box as="section" px={{ base: 4, md: 6, lg: 10 }} pt={{ base: 6, md: 8 }}>
      <Container maxW="container.xl" px={0}>
        <HStack spacing={3} flexWrap="wrap" justify="center">
          <Text
            color="text.secondary"
            fontSize={{ base: "sm", md: "md" }}
            fontWeight="medium"
            mr={{ base: 0, md: 1 }}
          >
            Browse all:
          </Text>
          {directories.map((directory) => (
            <Link
              key={directory.href}
              as={NLink}
              href={directory.href}
              display="inline-flex"
              alignItems="center"
              gap={2.5}
              px={4}
              py={2.5}
              minH="2.75rem"
              border="1px solid"
              borderColor="border.default"
              bg="bg.subtle"
              color="text.primary"
              rounded="full"
              _hover={{
                bg: "bg.muted",
                borderColor: "primary.500",
                textDecoration: "none",
              }}
            >
              <Icon as={directory.icon} color="text.tertiary" boxSize={4} />
              <Text fontWeight="semibold">{directory.label}</Text>
              <Badge
                bg="bg.emphasis"
                color="text.secondary"
                rounded="full"
                px={2}
                py={0.5}
              >
                {directory.count}
              </Badge>
            </Link>
          ))}
        </HStack>
      </Container>
    </Box>
  );
};
