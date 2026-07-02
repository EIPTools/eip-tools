"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  HStack,
  Heading,
  Text,
  Tooltip,
  Table,
  Tr,
  Th,
  Td,
  Link,
  Stack,
  Button,
} from "@chakra-ui/react";
import { FiShuffle, FiSun } from "react-icons/fi";
import { validEIPs, validEIPsArray } from "@/data/validEIPs";
import { EIPStatus, convertMetadataToJson, extractMetadata } from "@/utils";
import { EipMetadataJson } from "@/types";
import { useTopLoaderRouter } from "@/hooks/useTopLoaderRouter";
import { AuthorsMetadata } from "@/components/AuthorsMetadata";
import { SectionHeading } from "@/components/SectionHeading";

const getValueBasedOnDate = <T,>(values: T[]): T => {
  const today = new Date();
  const utcDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  // Convert the UTC date to a string and calculate its seed
  const dateString = utcDate.toISOString().split("T")[0];
  const seed = hashString(dateString);

  // Use a PRNG with the seed to generate an index
  const index = seededRandom(seed) % values.length;

  return values[index];
};

const hashString = (str: string): number => {
  let hash = 0,
    i,
    chr;
  if (str.length === 0) return hash;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return Math.abs(Math.floor(x));
};

export const EIPOfTheDay = () => {
  const router = useTopLoaderRouter();

  const [eipNo, setEipNo] = useState(getValueBasedOnDate(validEIPsArray));
  const [isRandomBtnLoading, setIsRandomBtnLoading] = useState(false);

  const [metadataJson, setMetadataJson] = useState<EipMetadataJson>();
  const [markdown, setMarkdown] = useState<string>("");
  const [isERC, setIsERC] = useState<boolean>(true);

  const fetchEIPData = useCallback(async () => {
    const validEIPData = validEIPs[eipNo];
    let _isERC = true;

    let eipMarkdownRes = "";

    if (validEIPData) {
      eipMarkdownRes = await fetch(validEIPData.markdownPath).then((response) =>
        response.text()
      );
      _isERC = validEIPData.isERC ?? false;
    } else {
      eipMarkdownRes = await fetch(
        `https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-${eipNo}.md`
      ).then((response) => response.text());

      if (eipMarkdownRes === "404: Not Found") {
        eipMarkdownRes = await fetch(
          `https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-${eipNo}.md`
        ).then((response) => response.text());
        _isERC = false;
      }
    }

    const { metadata, markdown: _markdown } = extractMetadata(eipMarkdownRes);
    setMetadataJson(convertMetadataToJson(metadata));
    setMarkdown(_markdown);
    setIsERC(_isERC);
  }, [eipNo]);

  useEffect(() => {
    fetchEIPData();
  }, [eipNo, fetchEIPData]);

  useEffect(() => {
    setIsRandomBtnLoading(false);
  }, [metadataJson]);

  return (
    <Box as="section" mt={10} px={{ base: 4, md: 6, lg: 10 }}>
      <Box maxW="container.xl" mx="auto">
        <SectionHeading icon={FiSun}>EIP of the day</SectionHeading>
        <Text mt={1} color="text.secondary" fontSize="sm">
          A deterministic daily proposal, selected in UTC.
        </Text>
      </Box>
      {metadataJson && (
        <Box mt={4} maxW="container.xl" mx="auto">
          <Box position="relative">
            <Button
              position="absolute"
              top={4}
              right={4}
              size="sm"
              variant="secondary"
              leftIcon={<FiShuffle />}
              isLoading={isRandomBtnLoading}
              onClick={() => {
                // random element from validEIPsArray
                const randomIndex = Math.floor(
                  Math.random() * validEIPsArray.length
                );
                const randomEIPNo = validEIPsArray[randomIndex];
                setIsRandomBtnLoading(true);
                setEipNo(randomEIPNo);
              }}
            >
              Random EIP
            </Button>
            <Box
              p={{ base: 5, md: 8 }}
              pt={{ base: 16, md: 8 }}
              border="1px solid"
              borderColor="border.default"
              bg="bg.subtle"
              rounded="lg"
              cursor={"pointer"}
              _hover={{
                bg: "bg.muted",
                borderColor: "primary.500",
              }}
              transition="background-color 0.2s ease, border-color 0.2s ease"
              onClick={() => {
                router.push(`/eip/${eipNo}`);
              }}
            >
              <Box
                opacity={isRandomBtnLoading ? 0 : 1}
                transition="opacity 0.1s ease"
              >
                <Stack direction={{ base: "column", sm: "row" }}>
                  <Tooltip label={EIPStatus[metadataJson.status]?.description}>
                    <Badge
                      px={2.5}
                      py={1}
                      bg={EIPStatus[metadataJson.status]?.bg ?? "cyan.500"}
                      fontWeight={600}
                      rounded="md"
                      alignSelf="flex-start"
                      color="white"
                    >
                      {EIPStatus[metadataJson.status]?.prefix}{" "}
                      {metadataJson.status}
                    </Badge>
                  </Tooltip>
                  <Badge
                    p={1}
                    bg="primary.500"
                    fontWeight="600"
                    rounded="md"
                    alignSelf="flex-start"
                    color="white"
                  >
                    {metadataJson.type}: {metadataJson.category}
                  </Badge>
                </Stack>

                <Heading mt={4} size="xl" pr={{ base: 0, md: 32 }}>
                  {isERC ? "ERC" : "EIP"}-{eipNo}: {metadataJson.title}
                </Heading>
                <Text mt={2} color="text.secondary" fontSize="sm">
                  {metadataJson.description}
                </Text>
                <Box overflowX={"auto"}>
                  <Table variant="simple">
                    {metadataJson.author && (
                      <Tr>
                        <Th>Authors</Th>
                        <Td>
                          <AuthorsMetadata
                            authors={metadataJson.author}
                            maxHeight="4rem"
                          />
                        </Td>
                      </Tr>
                    )}
                    {metadataJson.created && (
                      <Tr>
                        <Th>Created</Th>
                        <Td>{metadataJson.created}</Td>
                      </Tr>
                    )}
                    {metadataJson["discussions-to"] && (
                      <Tr>
                        <Th>Discussion Link</Th>
                        <Td>
                          <Link
                            color="primary.400"
                            onClick={(e) => {
                              e.stopPropagation();
                              // open in new tab
                              window.open(
                                metadataJson["discussions-to"],
                                "_blank"
                              );
                            }}
                          >
                            {metadataJson["discussions-to"]}
                          </Link>
                        </Td>
                      </Tr>
                    )}
                    {metadataJson.requires &&
                      metadataJson.requires.length > 0 && (
                        <Tr>
                          <Th>Requires</Th>
                          <Td>
                            <HStack>
                              {metadataJson.requires.map((req, i) => (
                                <Link
                                  key={i}
                                  onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/eip/${req}`);
                          }}
                        >
                          <Text
                                    color="primary.400"
                            _hover={{ textDecor: "underline" }}
                          >
                                    {validEIPs[req].isERC ? "ERC" : "EIP"}-{req}
                                  </Text>
                                </Link>
                              ))}
                            </HStack>
                          </Td>
                        </Tr>
                      )}
                  </Table>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
