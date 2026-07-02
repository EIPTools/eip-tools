"use client";
import React, { useState } from "react";
import { usePathname } from "next/navigation";
import {
  VStack,
  Flex,
  Box,
  Badge,
  Center,
  Heading,
  Link,
  HStack,
  Image,
  Input,
  Text,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  useDisclosure,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from "@chakra-ui/react";
import { useTopLoaderRouter } from "@/hooks/useTopLoaderRouter";
import { FaBook, FaTrashAlt, FaShareAlt, FaCopy } from "react-icons/fa";
import { Searchbox } from "@/components/Searchbox";
import { EIPType } from "@/types";
import { EIPStatus, getBaseUrl } from "@/utils";
import { useLocalStorage } from "usehooks-ts";
import { NotificationBar } from "./NotificationBar";

export const Navbar = () => {
  interface Bookmark {
    eipNo: number;
    type?: EIPType;
    title: string;
    status?: string;
  }
  const router = useTopLoaderRouter();
  const pathname = usePathname();
  const isProposalPage = /^\/(eip|rip|caip)\/[^/]+/.test(pathname);
  const {
    isOpen: isModalOpen,
    onOpen: openModal,
    onClose: closeModal,
  } = useDisclosure();
  const {
    isOpen: isDrawerOpen,
    onOpen: openDrawer,
    onClose: closeDrawer,
  } = useDisclosure();
  const [bookmarks, setBookmarks] = useLocalStorage<Bookmark[]>(
    "eip-bookmarks",
    []
  );
  const [isCopied, setIsCopied] = useState(false);

  const removeBookmark = (eipNo: number, type?: EIPType) => {
    const updatedBookmarks = bookmarks.filter(
      (item) => item.eipNo !== eipNo || item.type !== type
    );
    setBookmarks(updatedBookmarks);
  };

  const generateShareableLink = () => {
    const baseUrl = getBaseUrl();

    try {
      if (!bookmarks || bookmarks.length === 0) {
        console.warn("No bookmarks available to generate a link.");
        return baseUrl;
      }

      const groupedBookmarks = bookmarks.reduce<Record<string, number[]>>(
        (acc, bookmark) => {
          if (!bookmark.eipNo) {
            console.warn("Bookmark missing eipNo:", bookmark);
            return acc;
          }

          const type = bookmark.type ? bookmark.type.toLowerCase() : "eip";

          if (!acc[type]) {
            acc[type] = [];
          }

          acc[type].push(bookmark.eipNo);
          return acc;
        },
        {}
      );

      console.debug("Grouped Bookmarks:", groupedBookmarks);

      const queryString = Object.entries(groupedBookmarks)
        .map(([type, eipNos]) => `${type}=${eipNos.join(",")}`)
        .join(",");

      console.debug("Generated Query String:", queryString);

      return `${baseUrl}/shared?${queryString}`;
    } catch (error) {
      console.error("Error generating shareable link:", error);
      return `${baseUrl}/shared`;
    }
  };

  const handleCopy = () => {
    const shareableLink = generateShareableLink();
    navigator.clipboard
      .writeText(shareableLink)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch((error) => console.error("Failed to copy link:", error));
  };

  const shareableLink = isModalOpen ? generateShareableLink() : "";
  const bookmarkCountText = `${bookmarks.length} ${
    bookmarks.length === 1 ? "proposal" : "proposals"
  }`;

  return (
    <VStack w="100%" spacing={0}>
      <Flex
        w="100%"
        py={3}
        px={{ base: 4, md: 6 }}
        alignItems="center"
        justifyContent="space-between"
        gap={{ base: 3, lg: 6 }}
        flexWrap={{ base: isProposalPage ? "wrap" : "nowrap", lg: "nowrap" }}
        borderBottom="1px solid"
        borderColor="border.subtle"
        bg="bg.base"
      >
        <Link
          href={"/"}
          _hover={{ textDecoration: "none" }}
          flexShrink={0}
        >
          <HStack spacing={{ base: 2, sm: 3 }}>
            <Image
              alt="EIP.tools"
              src="/eth.png"
              h={{ base: "2rem", sm: "2.25rem" }}
              w="auto"
              objectFit="contain"
              flexShrink={0}
              rounded="md"
            />
            <Heading
              color="text.primary"
              fontSize={{ base: "lg", sm: "xl", md: "2xl" }}
              fontWeight="semibold"
              letterSpacing="-0.02em"
            >
              EIP.tools
            </Heading>
          </HStack>
        </Link>
        {isProposalPage && (
          <Box
            order={{ base: 3, lg: 2 }}
            flex={{ base: "0 0 100%", lg: "1" }}
            display="flex"
            justifyContent="center"
            minW={0}
          >
            <Searchbox />
          </Box>
        )}
        <Button
          order={{ base: 2, lg: 3 }}
          onClick={openDrawer}
          variant="ghost"
          color="text.secondary"
          flexShrink={0}
          _hover={{ color: "text.primary", bg: "bg.emphasis" }}
        >
          <HStack spacing={2}>
            <FaBook />
            <Text display={{ base: "none", md: "inline" }}>Reading List</Text>
          </HStack>
        </Button>
      </Flex>
      <NotificationBar />
      {!isProposalPage && (
        <Box
          w="100%"
          py={{ base: 5, md: 6 }}
          px={4}
          borderBottom="1px solid"
          borderColor="border.subtle"
          bg="bg.base"
        >
          <Center>
            <Searchbox />
          </Center>
        </Box>
      )}

      <Drawer isOpen={isDrawerOpen} onClose={closeDrawer} placement="right">
        <DrawerOverlay backdropFilter="blur(8px)" bg="blackAlpha.600" />
        <DrawerContent bg="bg.base" maxW="360px">
          <DrawerCloseButton />
          <DrawerHeader borderBottom="1px solid" borderColor="border.subtle">
            <HStack spacing={3}>
              {bookmarks.length > 0 && (
                <Button
                  onClick={openModal}
                  size="sm"
                  variant="secondary"
                  aria-label="Share reading list"
                >
                  <FaShareAlt />
                </Button>
              )}
              <Box>Reading List</Box>
            </HStack>
          </DrawerHeader>
          <DrawerBody>
            {bookmarks.length > 0 ? (
              <>
                {bookmarks.map((bookmark) => {
                  const eipTypeLabel = bookmark.type
                    ? bookmark.type === "RIP"
                      ? "RIP"
                      : bookmark.type === "CAIP"
                      ? "CAIP"
                      : "EIP"
                    : "EIP";

                  return (
                    <Box
                      key={`${bookmark.type}-${bookmark.eipNo}`}
                      p="3"
                      mb={2}
                      border="1px solid"
                      borderColor="border.default"
                      bg="bg.subtle"
                      color="text.primary"
                      fontSize="sm"
                      cursor="pointer"
                      position="relative"
                      transition="background-color 0.2s ease, border-color 0.2s ease"
                      _hover={{
                        bg: "bg.muted",
                        borderColor: "primary.500",
                      }}
                      onClick={() => {
                        router.push(
                          `/${
                            bookmark.type === "RIP"
                              ? "rip"
                              : bookmark.type === "CAIP"
                              ? "caip"
                              : "eip"
                          }/${bookmark.eipNo}`
                        );
                      }}
                      rounded="md"
                    >
                      <IconButton
                        icon={<FaTrashAlt />}
                        aria-label="Remove Bookmark"
                        position="absolute"
                        top="2"
                        right="2"
                        size="sm"
                        variant="ghost"
                        color="error.text"
                        _hover={{ color: "error.solid", bg: "whiteAlpha.100" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBookmark(bookmark.eipNo, bookmark.type);
                        }}
                      />
                      <Badge
                        px={2.5}
                        py={1}
                        bg={
                          bookmark.status
                            ? EIPStatus[bookmark.status]?.bg
                            : "cyan.500"
                        }
                        fontWeight={600}
                        rounded="md"
                        fontSize="xs"
                        color="white"
                      >
                        {bookmark.status
                          ? `${EIPStatus[bookmark.status]?.prefix} ${
                              bookmark.status
                            }`
                          : "Unknown Status"}
                      </Badge>
                      <Heading mt={1} fontSize="md">
                        {eipTypeLabel}-{bookmark.eipNo}
                      </Heading>
                      <Text color="text.secondary" fontSize="sm">
                        {bookmark.title}
                      </Text>
                    </Box>
                  );
                })}
              </>
            ) : (
              <Text color="text.secondary">No bookmarks yet.</Text>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <Modal isOpen={isModalOpen} onClose={closeModal} isCentered>
        <ModalOverlay backdropFilter="blur(10px)" bg="blackAlpha.700" />
        <ModalContent
          mx={4}
          maxW="36rem"
          bg="bg.base"
          border="1px solid"
          borderColor="border.default"
          boxShadow="dark-lg"
          overflow="hidden"
        >
          <ModalHeader
            px={6}
            pt={6}
            pb={4}
            borderBottom="1px solid"
            borderColor="border.subtle"
          >
            <VStack align="flex-start" spacing={1} pr={8}>
              <Box>Share Reading List</Box>
              <Text color="text.tertiary" fontSize="sm" fontWeight="normal">
                {bookmarkCountText}
              </Text>
            </VStack>
          </ModalHeader>
          <ModalCloseButton top={4} right={4} />
          <ModalBody px={6} py={5}>
            <VStack align="stretch" spacing={3}>
              <Text
                color="text.tertiary"
                fontSize="xs"
                fontWeight="medium"
              >
                Share link
              </Text>
              <Input
                value={shareableLink}
                isReadOnly
                aria-label="Share reading list link"
                variant="filled"
                bg="bg.subtle"
                color="text.primary"
                fontFamily="mono"
                fontSize="sm"
                size="md"
                overflow="auto"
                whiteSpace="nowrap"
                cursor="text"
                sx={{
                  "::-webkit-scrollbar": {
                    height: "6px",
                  },
                  "::-webkit-scrollbar-thumb": {
                    bg: "border.strong",
                    borderRadius: "full",
                  },
                  "::-webkit-scrollbar-thumb:hover": {
                    bg: "text.tertiary",
                  },
                }}
                rounded="lg"
              />
              <HStack justify="flex-end">
                <Button
                  leftIcon={<FaCopy />}
                  onClick={handleCopy}
                  isDisabled={isCopied}
                  size="md"
                  variant="primary"
                >
                  {isCopied ? "Copied" : "Copy link"}
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
};
