"use client";

import NLink from "next/link";
import { useCallback, useEffect, useState, useRef } from "react";
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
  getReferencedByEIPs,
} from "@/utils";
import { EIPType } from "@/types";
import { validEIPs, validEIPsArray } from "@/data/validEIPs";
import { EipMetadataJson } from "@/types";
import { eipGraphData } from "@/data/eipGraphData";
import { useTopLoaderRouter } from "@/hooks/useTopLoaderRouter";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { CopyToClipboard } from "@/components/CopyToClipboard";
import { EIPDependencyGraph } from "@/components/EIPDependencyGraph";
import { AuthorsMetadata } from "@/components/AuthorsMetadata";

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
  const previousEIPNo =
    currentEIPArrayIndex > 0
      ? validEIPsArray[currentEIPArrayIndex - 1]
      : undefined;
  const nextEIPNo =
    currentEIPArrayIndex < validEIPsArray.length - 1
      ? validEIPsArray[currentEIPArrayIndex + 1]
      : undefined;
  const getEIPDisplayLabel = (proposalNo: string) => {
    const proposal = validEIPs[parseInt(proposalNo)];
    return `${proposal?.isERC ? "ERC" : "EIP"}-${proposalNo}`;
  };
  const previousEIPLabel = previousEIPNo
    ? getEIPDisplayLabel(previousEIPNo)
    : "";
  const nextEIPLabel = nextEIPNo ? getEIPDisplayLabel(nextEIPNo) : "";

  const {
    isOpen: aiSummaryIsOpen,
    onToggle: aiSummaryOnToggle,
  } = useDisclosure();

  const {
    isOpen: dependencyGraphIsOpen,
    onToggle: dependencyGraphOnToggle,
    onOpen: dependencyGraphOnOpen,
  } = useDisclosure();

  const dependencyGraphRef = useRef<HTMLDivElement>(null);
  const [copiedAnchor, setCopiedAnchor] = useState(false);

  const handleCopyAnchorLink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}#dependency-graph`;
    // Update browser URL with hash
    window.history.pushState(null, "", "#dependency-graph");
    // Copy to clipboard
    navigator.clipboard.writeText(url);
    setCopiedAnchor(true);
    setTimeout(() => setCopiedAnchor(false), 2000);
  }, []);

  // Handle hash navigation on page load
  useEffect(() => {
    if (typeof window !== "undefined" && metadataJson) {
      const hash = window.location.hash;
      if (hash === "#dependency-graph") {
        // Open the collapse
        dependencyGraphOnOpen();
        // Scroll to the section after a short delay to ensure DOM is ready
        setTimeout(() => {
          dependencyGraphRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      }
    }
  }, [metadataJson, dependencyGraphOnOpen]);

  const handlePrevEIP = () => {
    if (previousEIPNo) {
      setMetadataJson(undefined);
      router.push(`/eip/${previousEIPNo}`);
    }
  };

  const handleNextEIP = () => {
    if (nextEIPNo) {
      setMetadataJson(undefined);
      router.push(`/eip/${nextEIPNo}`);
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
            {previousEIPNo && (
              <Tooltip label={`Previous ${previousEIPLabel}`} placement="top">
                <Button size="sm" variant="secondary" onClick={() => handlePrevEIP()}>
                  <ChevronLeftIcon />
                </Button>
              </Tooltip>
            )}
            <Spacer />
            {nextEIPNo && (
              <Tooltip label={`Next ${nextEIPLabel}`} placement="top">
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
            {previousEIPNo && (
              <Tooltip label={`Previous ${previousEIPLabel}`} placement="top">
                <Button size="sm" variant="secondary" onClick={() => handlePrevEIP()}>
                  <ChevronLeftIcon />
                </Button>
              </Tooltip>
            )}
            <Spacer />
            {nextEIPNo && (
              <Tooltip label={`Next ${nextEIPLabel}`} placement="top">
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
            {isERC ? "ERC" : "EIP"}-{eipNo}: {metadataJson.title}
          </Heading>
          <Text mt={2} color="text.secondary" fontSize="md" lineHeight="tall">
            {metadataJson.description}
          </Text>
          
          {/* Metadata Section Container */}
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
                        <NLink key={i} href={`/eip/${req}`}>
                          <Text
                            color="primary.400"
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
              {(() => {
                const referencedBy = getReferencedByEIPs(eipNo, eipGraphData);
                return referencedBy.length > 0 && (
                  <Tr>
                    <Th>Referenced by</Th>
                    <Td>
                      <HStack wrap="wrap">
                        {referencedBy.map((refEipNo, i) => (
                          <NLink key={i} href={`/eip/${refEipNo}`}>
                            <Text
                              color="primary.400"
                              _hover={{ textDecor: "underline" }}
                            >
                              {validEIPs[refEipNo]?.isERC ? "ERC" : "EIP"}-{refEipNo}
                            </Text>
                          </NLink>
                        ))}
                      </HStack>
                    </Td>
                  </Tr>
                );
              })()}
              {markdownFileURL && (
                <Tr>
                  <Th>
                    <HStack>
                      <Text>Markdown</Text>
                      <CopyToClipboard
                        textToCopy={markdownFileURL}
                        labelText=""
                        size={"xs"}
                      />
                    </HStack>
                  </Th>
                  <Td>
                    <Tooltip label={markdownFileURL}>
                      <Link
                        href={markdownFileURL}
                        color="primary.400"
                        isExternal
                      >
                        {markdownFileURL.length > 50
                          ? `${markdownFileURL.substring(0, 50)}...`
                          : markdownFileURL}
                      </Link>
                    </Tooltip>
                  </Td>
                </Tr>
              )}
            </Table>
          </Box>
            
            {/* EIP Dependency Graph */}
            <Box mt={6} ref={dependencyGraphRef} id="dependency-graph">
              {(() => {
                const requiredEips = metadataJson.requires?.length || 0;
                const referencedBy = getReferencedByEIPs(eipNo, eipGraphData);
                const totalConnections = requiredEips + referencedBy.length;
                
                if (totalConnections === 0) return null;
                
                return (
                  <>
                    <HStack w="100%" spacing={0}>
                      <Tooltip 
                        label={copiedAnchor ? "Copied!" : "Copy link to section"} 
                        hasArrow
                        closeOnClick={false}
                      >
                        <IconButton
                          aria-label="Copy anchor link"
                          icon={<Text fontWeight="bold">#</Text>}
                          variant="ghost"
                          size="sm"
                          color={copiedAnchor ? "success.text" : "text.tertiary"}
                          _hover={{ color: "primary.400", bg: "transparent" }}
                          onClick={handleCopyAnchorLink}
                          mb={3}
                          minW="auto"
                          h="auto"
                          p={0}
                          mr={1}
                        />
                      </Tooltip>
                      <Button
                        onClick={dependencyGraphOnToggle}
                        variant="ghost"
                        leftIcon={dependencyGraphIsOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        size="md"
                        color="text.secondary"
                        _hover={{ color: "text.primary", bg: "whiteAlpha.100" }}
                        mb={3}
                        fontWeight="600"
                        justifyContent="flex-start"
                        flex="1"
                        pl={1}
                      >
                        <Text>EIP Dependency Graph</Text>
                        <Text ml={2} fontSize="sm" color="text.tertiary">
                          ({totalConnections} connection{totalConnections !== 1 ? 's' : ''})
                        </Text>
                      </Button>
                    </HStack>
                    <Collapse in={dependencyGraphIsOpen} animateOpacity>
                      <EIPDependencyGraph currentEipNo={eipNo} isExpanded={dependencyGraphIsOpen} />
                    </Collapse>
                  </>
                );
              })()}
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

          {/* Main EIP Content */}
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

export default EIP;
