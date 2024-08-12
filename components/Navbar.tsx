"use client";
import React, { useState, useEffect } from "react";
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
} from "@chakra-ui/react";
import { useTopLoaderRouter } from "@/hooks/useTopLoaderRouter";
import { FaBook, FaTrashAlt } from "react-icons/fa";
import { Searchbox } from "@/components/Searchbox";
import { EIPType } from "@/types";
import { EIPStatus } from "@/utils";
import { useLocalStorage } from "usehooks-ts";

export const Navbar = () => {
  const router = useTopLoaderRouter();

  const {
    isOpen: isDrawerOpen,
    onOpen: openDrawer,
    onClose: closeDrawer,
  } = useDisclosure();

  interface Bookmark {
    eipNo: number;
    type?: EIPType;
    title: string;
    status?: string;
  }

  const [bookmarks, setBookmarks] = useLocalStorage<Bookmark[]>(
    "eip-bookmarks",
    []
  );

  const removeBookmark = (eipNo: number, type?: EIPType) => {
    const updatedBookmarks = bookmarks.filter(
      (item) => item.eipNo !== eipNo || item.type !== type
    );
    setBookmarks(updatedBookmarks);
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
      <Center mt={2}>
        <Searchbox />
      </Center>

      <Drawer isOpen={isDrawerOpen} onClose={closeDrawer} placement="right">
        <DrawerOverlay />
        <DrawerContent bg="bg.900">
          <DrawerCloseButton />
          <DrawerHeader>Reading List</DrawerHeader>
          <DrawerBody>
            {bookmarks.length > 0 ? (
              bookmarks.map((bookmark) => {
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
              })
            ) : (
              <Text>No bookmarks yet.</Text>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
};
