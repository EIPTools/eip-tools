"use client";

import { Box, Heading, Text, Flex, HStack, Badge } from "@chakra-ui/react";
import { validEIPs } from "@/data/validEIPs";
import { EIPGridItem } from "./TrendingEIPs";
import { EIPStatus } from "@/utils";

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
    <Box mt={10} px={10}>
      <Box>
        <HStack>
          <Heading>🍴 {upcomingHardForkName} Hardfork</Heading>
          <Badge
            p={1}
            bg={EIPStatus[upcomingHardForkStatus]?.bg ?? "cyan.500"}
            fontWeight={700}
            rounded="md"
          >
            {EIPStatus[upcomingHardForkStatus]?.prefix} {upcomingHardForkStatus}
          </Badge>
        </HStack>
        <Text fontSize={"md"} fontWeight={200}>
          (EIPs scheduled for inclusion in the {upcomingHardForkName} Hardfork)
        </Text>
      </Box>
      <Box
        mt={4}
        overflowX="auto"
        sx={{
          "::-webkit-scrollbar": {
            h: "12px",
          },
          "::-webkit-scrollbar-track ": {
            bg: "gray.400",
            rounded: "md",
          },
          "::-webkit-scrollbar-thumb": {
            bg: "gray.500",
            rounded: "md",
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
