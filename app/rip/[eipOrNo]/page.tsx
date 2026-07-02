"use client";

import NLink from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Markdown } from "@/components/Markdown";
import {
  Container,
  Heading,
  Center,
  Text,
  Table,
  Tr,
  Td,
  Th,
  Link,
  HStack,
  Badge,
  Tooltip,
  Box,
  Button,
  Spacer,
  Skeleton,
  SkeletonText,
  useDisclosure,
  Collapse,
} from "@chakra-ui/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@chakra-ui/icons";
import { FaBookmark, FaRegBookmark } from "react-icons/fa";
import { useLocalStorage } from "usehooks-ts";
import Typewriter from "typewriter-effect";
import {
  EIPStatus,
  convertMetadataToJson,
  extractEipNumber,
  extractMetadata,
} from "@/utils";
import { EIPType } from "@/types";
import { validRIPs, validRIPsArray } from "@/data/validRIPs";
import { EipMetadataJson } from "@/types";
import { useTopLoaderRouter } from "@/hooks/useTopLoaderRouter";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { AuthorsMetadata } from "@/components/AuthorsMetadata";

const RIP = ({
  params: { eipOrNo },
}: {
  params: {
    eipOrNo: string; // can be of the form `1234`, `eip-1234` or `eip-1234.md` (standard followed by official EIP)
  };
}) => {
  const router = useTopLoaderRouter();

  const eipNo = extractEipNumber(eipOrNo, "rip");

  const [markdownFileURL, setMarkdownFileURL] = useState<string>("");
  const [metadataJson, setMetadataJson] = useState<EipMetadataJson>();
  const [markdown, setMarkdown] = useState<string>("");
  const [bookmarks, setBookmarks] = useLocalStorage<
    { eipNo: string; title: string; type?: EIPType; status?: string }[]
  >("eip-bookmarks", []);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const [aiSummary, setAiSummary] = useState<string>("");

  const currentEIPArrayIndex = validRIPsArray.indexOf(eipNo);
  const previousRIPNo =
    currentEIPArrayIndex > 0
      ? validRIPsArray[currentEIPArrayIndex - 1]
      : undefined;
  const nextRIPNo =
    currentEIPArrayIndex < validRIPsArray.length - 1
      ? validRIPsArray[currentEIPArrayIndex + 1]
      : undefined;
  const previousRIPLabel = previousRIPNo ? `RIP-${previousRIPNo}` : "";
  const nextRIPLabel = nextRIPNo ? `RIP-${nextRIPNo}` : "";

  const {
    isOpen: aiSummaryIsOpen,
    onToggle: aiSummaryOnToggle,
  } = useDisclosure();

  const handlePrevEIP = () => {
    if (previousRIPNo) {
      setMetadataJson(undefined);
      router.push(`/rip/${previousRIPNo}`);
    }
  };

  const handleNextEIP = () => {
    if (nextRIPNo) {
      setMetadataJson(undefined);
      router.push(`/rip/${nextRIPNo}`);
    }
  };

  const fetchEIPData = useCallback(async () => {
    const validEIPData = validRIPs[parseInt(eipNo)];

    let _markdownFileURL = "";
    let eipMarkdownRes = "";

    if (validEIPData) {
      _markdownFileURL = validEIPData.markdownPath;
      eipMarkdownRes = await fetch(_markdownFileURL).then((response) =>
        response.text()
      );
    } else {
      _markdownFileURL = `https://raw.githubusercontent.com/ethereum/RIPs/master/RIPS/rip-${eipNo}.md`;
      eipMarkdownRes = await fetch(_markdownFileURL).then((response) =>
        response.text()
      );
    }
    setMarkdownFileURL(_markdownFileURL);

    const { metadata, markdown: _markdown } = extractMetadata(eipMarkdownRes);
    setMetadataJson(convertMetadataToJson(metadata));
    setMarkdown(_markdown);

    // only add to trending if it's a valid EIP
    if (
      eipMarkdownRes !== "404: Not Found" &&
      process.env.NEXT_PUBLIC_DEVELOPMENT !== "true"
    ) {
      fetch("/api/logPageVisit", {
        method: "POST",
        body: JSON.stringify({ eipNo, type: "RIP" }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  }, [eipNo]);

  const fetchAISummary = useCallback(async () => {
    fetch("/api/aiSummary", {
      method: "POST",
      body: JSON.stringify({ eipNo, type: "RIP" }),
      headers: {
        "Content-Type": "application/json",
      },
    }).then((response) => {
      response.json().then((data) => {
        setAiSummary(data);
      });
    });
  }, [eipNo]);

  useEffect(() => {
    fetchEIPData();
  }, [eipNo, fetchEIPData]);

  // Fetch AI Summary when clicked
  useEffect(() => {
    if (aiSummaryIsOpen && !aiSummary) {
      fetchAISummary();
    }
  }, [aiSummaryIsOpen, aiSummary, fetchAISummary]);

  useEffect(() => {
    setIsBookmarked(bookmarks.some((item) => item.eipNo === eipNo));
  }, [bookmarks, eipNo]);

  const toggleBookmark = () => {
    if (isBookmarked) {
      const updatedBookmarks = bookmarks.filter(
        (item: any) => item.eipNo !== eipNo
      );
      setBookmarks(updatedBookmarks);
    } else {
      const newBookmark = {
        eipNo,
        title: metadataJson?.title || "",
        type: EIPType.RIP,
        status: metadataJson?.status || "",
      };
      setBookmarks([...bookmarks, newBookmark]);
    }
    setIsBookmarked(!isBookmarked);
  };

  return (
    <Center flexDir="column" w="100%" px={{ base: 4, md: 6 }}>
      {!metadataJson && (
        <>
          <HStack
            mt={8}
            mb={2}
            px={"1rem"}
            w={{
              base: "27rem",
              md: "45rem",
              lg: "60rem",
            }}
          >
            {previousRIPNo && (
              <Tooltip label={`Previous ${previousRIPLabel}`} placement="top">
                <Button size="sm" variant="secondary" onClick={() => handlePrevEIP()}>
                  <ChevronLeftIcon />
                </Button>
              </Tooltip>
            )}
            <Spacer />
            {nextRIPNo && (
              <Tooltip label={`Next ${nextRIPLabel}`} placement="top">
                <Button size="sm" variant="secondary" onClick={() => handleNextEIP()}>
                  <ChevronRightIcon />
                </Button>
              </Tooltip>
            )}
          </HStack>
          <Container
            mt={4}
            maxW="container.lg"
            w="100%"
          >
            <HStack>
              <Skeleton>
                <Badge p={1} fontWeight={700} rounded="md">
                  Draft
                </Badge>
              </Skeleton>
              <Skeleton>
                <Badge p={1} bg="primary.500" color="white" fontWeight="600" rounded="md">
                  Standards Track: ERC
                </Badge>
              </Skeleton>
            </HStack>
            <Skeleton mt={1} w="80%" h="2rem">
              TITLE
            </Skeleton>
            <Skeleton mt={1}>
              <Text size="md">some description about the EIP</Text>
            </Skeleton>
          </Container>
        </>
      )}
      {metadataJson && (
        <Container
          mt={6}
          maxW="container.lg"
          w="100%"
          px={0}
        >
          {/* Navigation Arrows */}
          <HStack mb={2}>
            {previousRIPNo && (
              <Tooltip label={`Previous ${previousRIPLabel}`} placement="top">
                <Button size="sm" variant="secondary" onClick={() => handlePrevEIP()}>
                  <ChevronLeftIcon />
                </Button>
              </Tooltip>
            )}
            <Spacer />
            {nextRIPNo && (
              <Tooltip label={`Next ${nextRIPLabel}`} placement="top">
                <Button size="sm" variant="secondary" onClick={() => handleNextEIP()}>
                  <ChevronRightIcon />
                </Button>
              </Tooltip>
            )}
          </HStack>
          {/* Metadata Badges */}
          <HStack>
            <Tooltip label={EIPStatus[metadataJson.status]?.description}>
              <Badge
                px={2.5}
                py={1}
                bg={EIPStatus[metadataJson.status]?.bg ?? "cyan.500"}
                fontWeight={600}
                rounded="md"
                color="white"
              >
                {EIPStatus[metadataJson.status]?.prefix} {metadataJson.status}
              </Badge>
            </Tooltip>
            <Badge p={1} bg="primary.500" color="white" fontWeight="600" rounded="md">
              {metadataJson.type}: {metadataJson.category}
            </Badge>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                toggleBookmark();
              }}
              color={isBookmarked ? "primary.400" : "text.tertiary"}
              _hover={{ color: "primary.300", bg: "bg.emphasis" }}
              variant="ghost"
              size="lg"
              ml="auto"
              display="flex"
              alignItems="center"
            >
              <HStack spacing={2}>
                {isBookmarked ? <FaBookmark /> : <FaRegBookmark />}
                <Text display={{ base: "none", md: "inline" }}>
                  {isBookmarked
                    ? "Added to reading list"
                    : "Add to reading list"}
                </Text>
              </HStack>
            </Button>
          </HStack>
          <Heading mt={3} size="2xl">
            RIP-{eipNo}: {metadataJson.title}
          </Heading>
          <Text mt={2} color="text.secondary" fontSize="md" lineHeight="tall">
            {metadataJson.description}
          </Text>
          <Box
            mt={6}
            px={6}
            pt={2}
            pb={6}
            bg="bg.subtle"
            border="1px solid"
            borderColor="border.default"
            borderRadius="lg"
          >
          <Box
            overflowX="auto"
            sx={{
              "@media (max-width: 48em)": {
                table: { display: "block" },
                tbody: { display: "block" },
                tr: {
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  py: 3,
                },
                th: {
                  display: "block",
                  width: "100%",
                  borderBottom: 0,
                  pb: 1,
                },
                td: {
                  display: "block",
                  width: "100%",
                  pt: 0,
                  overflowWrap: "anywhere",
                },
              },
            }}
          >
            <Table variant="simple">
              {metadataJson.author && (
                <Tr>
                  <Th>Authors</Th>
                  <Td>
                    <AuthorsMetadata authors={metadataJson.author} />
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
                      href={metadataJson["discussions-to"]}
                      color="primary.400"
                      isExternal
                    >
                      {metadataJson["discussions-to"]}
                    </Link>
                  </Td>
                </Tr>
              )}
              {metadataJson.requires && metadataJson.requires.length > 0 && (
                <Tr>
                  <Th>Requires</Th>
                  <Td>
                    <HStack>
                      {metadataJson.requires.map((req, i) => (
                        <NLink key={i} href={`/rip/${req}`}>
                          <Text
                            color="primary.400"
                            _hover={{ textDecor: "underline" }}
                          >
                            RIP-{req}
                          </Text>
                        </NLink>
                      ))}
                    </HStack>
                  </Td>
                </Tr>
              )}
            </Table>
          </Box>
          </Box>
          {/* AI Summary */}
          <Box
            px={4}
            py={3}
            mt={4}
            border="1px solid"
            borderColor="warning.border"
            bg="warning.bg"
            rounded="lg"
            maxH={{ base: "10rem", md: "100vh" }}
            overflowY={"auto"}
            color="warning.text"
            _hover={{
              borderColor: "warning.solid",
            }}
          >
            <HStack cursor={"pointer"} onClick={aiSummaryOnToggle}>
              <Text color="warning.text" fontWeight="medium">
                EIP-GPT summary
              </Text>
              <Spacer />
              <Text color="warning.text" fontSize="xl">
                {aiSummaryIsOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </Text>
            </HStack>
            <Collapse in={aiSummaryIsOpen} animateOpacity>
              {aiSummary ? (
                <Box color="text.primary" pt={3}>
                  <Typewriter
                    onInit={(typewriter) => {
                      typewriter.typeString(`${aiSummary}`).start();
                    }}
                    options={{
                      delay: 5,
                    }}
                  />
                </Box>
              ) : (
                <SkeletonText />
              )}
            </Collapse>
          </Box>

          <Box mt={8} w="100%">
            {markdown === "404: Not Found" ? (
              <Center mt={20}>{markdown}</Center>
            ) : (
              <Markdown md={markdown} markdownFileURL={markdownFileURL} />
            )}
          </Box>
        </Container>
      )}
      <ScrollToTopButton />
    </Center>
  );
};

export default RIP;
