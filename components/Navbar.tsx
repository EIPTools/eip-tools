"use client";
import React, { useState } from "react";
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

      return `${baseUrl}?${queryString}`;
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

  return (
    <VStack w="100%" spacing={0}>
      <Flex w="100%" justify="center" position="relative" p={4}>
        <Center>
          <Heading color="custom.pale">
            <Link href={"/"}>
              <HStack spacing={"4"}>
                <Image w="1.5rem" alt="icon" src="/eth.png" rounded={"lg"} />
                <Text>EIP.tools</Text>
              </HStack>
            </Link>
          </Heading>
        </Center>
        <Button onClick={openDrawer} position="absolute" right="4" top="4">
          <HStack spacing={2}>
            <FaBook />
            <Text display={{ base: "none", md: "inline" }}>Reading List</Text>
          </HStack>
        </Button>
      </Flex>
      <NotificationBar />
      <Center mt={2}>
        <Searchbox />
      </Center>

      <Drawer isOpen={isDrawerOpen} onClose={closeDrawer} placement="right">
        <DrawerOverlay />
        <DrawerContent bg="bg.900">
          <DrawerCloseButton />
          <DrawerHeader>
            <HStack>
              {bookmarks.length > 0 && (
                <Button onClick={openModal} size="sm">
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
                      borderColor="gray.500"
                      bg="white"
                      color="black"
                      fontSize="sm"
                      cursor="pointer"
                      position="relative"
                      transition="all 0.1s ease-in-out"
                      _hover={{
                        bg: "gray.600",
                        color: "white",
                        borderColor: "blue.300",
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
                        color="red.500"
                        _hover={{ color: "red.300" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBookmark(bookmark.eipNo, bookmark.type);
                        }}
                      />
                      <Badge
                        p={1}
                        bg={
                          bookmark.status
                            ? EIPStatus[bookmark.status]?.bg
                            : "cyan.500"
                        }
                        fontWeight={600}
                        rounded="md"
                        fontSize="xs"
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
                      <Text fontSize="sm">{bookmark.title}</Text>
                    </Box>
                  );
                })}
              </>
            ) : (
              <Text>No bookmarks yet.</Text>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <ModalOverlay />
        <ModalContent bg="bg.900">
          <ModalHeader>Share Reading List</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack pb="4" spacing={4}>
              <Link href={generateShareableLink()} w="full" cursor={"pointer"}>
                <Input
                  value={generateShareableLink()}
                  isReadOnly
                  variant="filled"
                  color="blue.100"
                  size="sm"
                  overflow="auto"
                  whiteSpace="nowrap"
                  cursor={"pointer"}
                  sx={{
                    "::-webkit-scrollbar": {
                      height: "6px",
                    },
                    "::-webkit-scrollbar-thumb": {
                      background: "#888",
                      borderRadius: "4px",
                    },
                    "::-webkit-scrollbar-thumb:hover": {
                      background: "#555",
                    },
                  }}
                  rounded="lg"
                />
              </Link>
              <Button
                leftIcon={<FaCopy />}
                onClick={handleCopy}
                isDisabled={isCopied}
                size={"sm"}
              >
                {isCopied ? "Copied!" : "Copy Link"}
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
};
