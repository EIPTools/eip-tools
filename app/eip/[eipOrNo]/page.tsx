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
  IconButton,
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
import { validEIPs, validEIPsArray } from "@/data/validEIPs";
import { EipMetadataJson } from "@/types";
import { useTopLoaderRouter } from "@/hooks/useTopLoaderRouter";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";

const EIP = ({
  params: { eipOrNo },
}: {
  params: {
    eipOrNo: string; // can be of the form `1234`, `eip-1234` or `eip-1234.md` (standard followed by official EIP)
  };
}) => {
  const router = useTopLoaderRouter();

  const eipNo = extractEipNumber(eipOrNo, "eip");

  const [markdownFileURL, setMarkdownFileURL] = useState<string>("");
  const [metadataJson, setMetadataJson] = useState<EipMetadataJson>();
  const [markdown, setMarkdown] = useState<string>("");
  const [isERC, setIsERC] = useState<boolean>(true);

  const [bookmarks, setBookmarks] = useLocalStorage<
    { eipNo: string; title: string; type?: EIPType; status?: string }[]
  >("eip-bookmarks", []);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const [aiSummary, setAiSummary] = useState<string>("");

  const currentEIPArrayIndex = validEIPsArray.indexOf(eipNo);

  const {
    isOpen: aiSummaryIsOpen,
    onOpen: aiSummaryOnOpen,
    onToggle: aiSummaryOnToggle,
  } = useDisclosure();

  const handlePrevEIP = () => {
    if (currentEIPArrayIndex > 0) {
      setMetadataJson(undefined);
      router.push(`/eip/${validEIPsArray[currentEIPArrayIndex - 1]}`);
    }
  };

  const handleNextEIP = () => {
    if (currentEIPArrayIndex < validEIPsArray.length - 1) {
      setMetadataJson(undefined);
      router.push(`/eip/${validEIPsArray[currentEIPArrayIndex + 1]}`);
    }
  };

  const fetchEIPData = useCallback(async () => {
    const validEIPData = validEIPs[parseInt(eipNo)];
    let _isERC = true;

    let _markdownFileURL = "";
    let eipMarkdownRes = "";

    if (validEIPData) {
      _markdownFileURL = validEIPData.markdownPath;
      eipMarkdownRes = await fetch(_markdownFileURL).then((response) =>
        response.text()
      );
      _isERC = validEIPData.isERC ?? false;
    } else {
      _markdownFileURL = `https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-${eipNo}.md`;
      eipMarkdownRes = await fetch(_markdownFileURL).then((response) =>
        response.text()
      );

      if (eipMarkdownRes === "404: Not Found") {
        _markdownFileURL = `https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-${eipNo}.md`;
        eipMarkdownRes = await fetch(_markdownFileURL).then((response) =>
          response.text()
        );
        _isERC = false;
      }
    }
    setMarkdownFileURL(_markdownFileURL);

    const { metadata, markdown: _markdown } = extractMetadata(eipMarkdownRes);
    setMetadataJson(convertMetadataToJson(metadata));
    setMarkdown(_markdown);
    setIsERC(_isERC);

    // only add to trending if it's a valid EIP
    if (
      eipMarkdownRes !== "404: Not Found" &&
      process.env.NEXT_PUBLIC_DEVELOPMENT !== "true"
    ) {
      fetch("/api/logPageVisit", {
        method: "POST",
        body: JSON.stringify({ eipNo, type: "EIP" }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  }, [eipNo]);

  const fetchAISummary = useCallback(async () => {
    fetch("/api/aiSummary", {
      method: "POST",
      body: JSON.stringify({ eipNo }),
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
  }, [aiSummaryIsOpen, aiSummary]);

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
        status: metadataJson?.status || "",
      };
      setBookmarks([...bookmarks, newBookmark]);
    }
    setIsBookmarked(!isBookmarked);
  };

  return (
    <Center flexDir={"column"}>
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
            {currentEIPArrayIndex > 0 && (
              <Tooltip label="Previous EIP" placement="top">
                <Button size="sm" onClick={() => handlePrevEIP()}>
                  <ChevronLeftIcon />
                </Button>
              </Tooltip>
            )}
            <Spacer />
            {currentEIPArrayIndex < validEIPsArray.length - 1 && (
              <Tooltip label="Next EIP" placement="top">
                <Button size="sm" onClick={() => handleNextEIP()}>
                  <ChevronRightIcon />
                </Button>
              </Tooltip>
            )}
          </HStack>
          <Container
            mt={4}
            mx={"10rem"}
            minW={{
              sm: "100%",
              md: "45rem",
              lg: "60rem",
            }}
          >
            <HStack>
              <Skeleton>
                <Badge p={1} fontWeight={700} rounded="md">
                  Draft
                </Badge>
              </Skeleton>
              <Skeleton>
                <Badge p={1} bg={"blue.500"} fontWeight={"bold"} rounded="md">
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
          mt={4}
          mx={"10rem"}
          minW={{
            sm: "100%",
            md: "45rem",
            lg: "60rem",
          }}
        >
          {/* Navigation Arrows */}
          <HStack mb={2}>
            {currentEIPArrayIndex > 0 && (
              <Tooltip label="Previous EIP" placement="top">
                <Button size="sm" onClick={() => handlePrevEIP()}>
                  <ChevronLeftIcon />
                </Button>
              </Tooltip>
            )}
            <Spacer />
            {currentEIPArrayIndex < validEIPsArray.length - 1 && (
              <Tooltip label="Next EIP" placement="top">
                <Button size="sm" onClick={() => handleNextEIP()}>
                  <ChevronRightIcon />
                </Button>
              </Tooltip>
            )}
          </HStack>
          {/* AI Summary */}
          <Box
            px={4}
            py={2}
            mb={2}
            border="solid"
            borderWidth="2px"
            borderColor={"yellow.500"}
            rounded={"lg"}
            maxH={{ base: "10rem", md: "100vh" }}
            overflowY={"auto"}
            color="yellow.400"
            _hover={{
              bg: "yellow.800",
              color: "white",
            }}
          >
            <HStack cursor={"pointer"} onClick={aiSummaryOnToggle}>
              <Text>💡 EIP-GPT:</Text>
              <Spacer />
              <Text fontSize={"xl"}>
                {aiSummaryIsOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </Text>
            </HStack>
            <Collapse in={aiSummaryIsOpen} animateOpacity>
              {aiSummary ? (
                <Box color="white">
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
          {/* Metadata Badges */}
          <HStack>
            <Tooltip label={EIPStatus[metadataJson.status]?.description}>
              <Badge
                p={1}
                bg={EIPStatus[metadataJson.status]?.bg ?? "cyan.500"}
                fontWeight={700}
                rounded="md"
              >
                {EIPStatus[metadataJson.status]?.prefix} {metadataJson.status}
              </Badge>
            </Tooltip>
            <Badge p={1} bg={"blue.500"} fontWeight={"bold"} rounded="md">
              {metadataJson.type}: {metadataJson.category}
            </Badge>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                toggleBookmark();
              }}
              color={isBookmarked ? "blue.500" : "gray.500"}
              _hover={{ color: isBookmarked ? "blue.400" : "gray.400" }}
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
          <Heading>
            {isERC ? "ERC" : "EIP"}-{eipNo}: {metadataJson.title}
          </Heading>
          <Text size="md">{metadataJson.description}</Text>
          <Box overflowX={"auto"}>
            <Table variant="simple">
              {metadataJson.author && (
                <Tr>
                  <Th>Authors</Th>
                  <Td>
                    <Box
                      maxH="10rem"
                      overflowY={"auto"}
                      p="2px"
                      sx={{
                        "::-webkit-scrollbar": {
                          w: "10px",
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
                      {metadataJson.author.join(", ")}
                    </Box>
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
                      color={"blue.400"}
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
                        <NLink key={i} href={`/eip/${req}`}>
                          <Text
                            color={"blue.400"}
                            _hover={{ textDecor: "underline" }}
                          >
                            {validEIPs[req].isERC ? "ERC" : "EIP"}-{req}
                          </Text>
                        </NLink>
                      ))}
                    </HStack>
                  </Td>
                </Tr>
              )}
            </Table>
          </Box>
          {markdown === "404: Not Found" ? (
            <Center mt={20}>{markdown}</Center>
          ) : (
            <Markdown md={markdown} markdownFileURL={markdownFileURL} />
          )}
        </Container>
      )}
      <ScrollToTopButton />
    </Center>
  );
};

export default EIP;
