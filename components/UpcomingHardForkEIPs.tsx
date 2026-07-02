"use client";

import { Box, Text, Flex, HStack, Badge } from "@chakra-ui/react";
import { FiGitBranch } from "react-icons/fi";
import { validEIPs } from "@/data/validEIPs";
import { EIPGridItem } from "./TrendingEIPs";
import { EIPStatus } from "@/utils";
import { SectionHeading } from "./SectionHeading";

export const UpcomingHardForkEIPs = () => {
  const upcomingHardForkName = "Glamsterdam";
  const upcomingHardForkMetaEIPNo = "7773";
  const upcomingHardForkStatus = validEIPs[upcomingHardForkMetaEIPNo].status!;
  const upcomingHardForkEIPsArray = [
    upcomingHardForkMetaEIPNo,
    // ...validEIPs[upcomingHardForkMetaEIPNo].requires!, // not upto date for Glamsterdam
    "7732",
    "7928",
  ];

  return (
    <Box as="section" mt={10} px={{ base: 4, md: 6, lg: 10 }}>
      <Box maxW="container.xl" mx="auto">
        <HStack align="center" spacing={3} wrap="wrap">
          <SectionHeading icon={FiGitBranch}>
            {upcomingHardForkName} hardfork
          </SectionHeading>
          <Badge
            px={2.5}
            py={1}
            bg={EIPStatus[upcomingHardForkStatus]?.bg ?? "cyan.500"}
            fontWeight={600}
            rounded="md"
            color="white"
          >
            {EIPStatus[upcomingHardForkStatus]?.prefix} {upcomingHardForkStatus}
          </Badge>
        </HStack>
        <Text mt={1} color="text.secondary" fontSize="sm">
          EIPs scheduled for inclusion in the {upcomingHardForkName} hardfork
        </Text>
      </Box>
      <Box
        maxW="container.xl"
        mx="auto"
        mt={4}
        overflowX="auto"
        sx={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.18) transparent",
          "::-webkit-scrollbar": {
            h: "4px",
          },
          "::-webkit-scrollbar-track ": {
            bg: "transparent",
          },
          "::-webkit-scrollbar-thumb": {
            bg: "rgba(255,255,255,0.18)",
            rounded: "full",
          },
          "::-webkit-scrollbar-thumb:hover": {
            bg: "rgba(255,255,255,0.28)",
          },
        }}
      >
        <Flex direction="row" minW="max-content" pb="2">
          {upcomingHardForkEIPsArray.map((eipNo) => (
            <EIPGridItem key={eipNo} eipNo={eipNo} />
          ))}
        </Flex>
      </Box>
    </Box>
  );
};
