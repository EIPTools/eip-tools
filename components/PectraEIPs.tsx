"use client";

import { Box, Heading, Text, Flex, HStack, Badge } from "@chakra-ui/react";
import { validEIPs } from "@/data/validEIPs";
import { EIPGridItem } from "./TrendingEIPs";
import { EIPStatus } from "@/utils";

export const PectraEIPs = () => {
  const pectraHardForkMetaEIPNo = "7600";
  const pectraHardForkStatus = validEIPs[pectraHardForkMetaEIPNo].status!;
  const pectraEIPsArray = [
    pectraHardForkMetaEIPNo,
    ...validEIPs[pectraHardForkMetaEIPNo].requires!,
  ];

  return (
    <Box mt={10} px={10}>
      <Box>
        <HStack>
          <Heading>🍴 Pectra Hardfork</Heading>
          <Badge
            p={1}
            bg={EIPStatus[pectraHardForkStatus]?.bg ?? "cyan.500"}
            fontWeight={700}
            rounded="md"
          >
            {EIPStatus[pectraHardForkStatus]?.prefix} {pectraHardForkStatus}
          </Badge>
        </HStack>
        <Text fontSize={"md"} fontWeight={200}>
          (EIPs scheduled for inclusion in the Prague-Electra Hardfork)
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
          {pectraEIPsArray.map((eipNo) => (
            <EIPGridItem key={eipNo} eipNo={eipNo} />
          ))}
        </Flex>
      </Box>
    </Box>
  );
};
