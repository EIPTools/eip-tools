"use client";

import { useSearchParams } from "next/navigation";
import {
  Button,
  Box,
  Heading,
  Text,
  Container,
  Center,
  VStack,
  useToast,
  HStack,
  Spacer,
} from "@chakra-ui/react";
import { useLocalStorage } from "usehooks-ts";
import { EIPType } from "@/types";
import React, { useMemo, Suspense } from "react";
import { validEIPs } from "@/data/validEIPs";
import { validRIPs } from "@/data/validRIPs";
import { validCAIPs } from "@/data/validCAIPs";
import { EIPGridItem } from "@/components/TrendingEIPs";
import { FaRegBookmark } from "react-icons/fa";

interface Bookmark {
  eipNo: string;
  type?: EIPType;
  title?: string;
  status?: string;
}

const SharedList = () => {
  return (
    <Suspense fallback={<Text>Loading...</Text>}>
      <SharedListContent />
    </Suspense>
  );
};

const SharedListContent = () => {
  const searchParams = useSearchParams();
  const toast = useToast();

  const queryKeys = ["eip", "erc", "caip", "rip"];
  const [bookmarks, setBookmarks] = useLocalStorage<Bookmark[]>(
    "eip-bookmarks",
    []
  );

  const paramKey = queryKeys.find((key) => searchParams.has(key));
  const paramValue = paramKey ? searchParams.get(paramKey) : null;

  const parsedItems = useMemo(() => {
    if (!paramValue || !paramKey) return [];

    try {
      return paramValue
        .toString()
        .split(",")
        .map((item) => {
          const [type, eipNo] = item.includes("=")
            ? item.split("=")
            : [paramKey, item];

          return {
            type: type.toUpperCase() as EIPType,
            eipNo,
          };
        });
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error parsing items:", error.message);
      } else {
        console.error("Error parsing items:", error);
      }
      return [];
    }
  }, [paramValue, paramKey]);

  const addToReadingList = () => {
    console.log({
      bookmarks,
      parsedItems,
    });

    const newBookmarks = parsedItems
      .filter((item) => {
        return !bookmarks.some(
          (bookmark) =>
            bookmark.eipNo === item.eipNo &&
            (bookmark.type ? bookmark.type === item.type.toUpperCase() : true)
        );
      })
      .map((item) => {
        const type = item.type.toUpperCase() as EIPType;
        let dataSource;

        if (type === EIPType.EIP) {
          dataSource = validEIPs;
        } else if (type === EIPType.RIP) {
          dataSource = validRIPs;
        } else if (type === EIPType.CAIP) {
          dataSource = validCAIPs;
        }

        const entry: { title?: string; status?: string } =
          dataSource?.[item.eipNo] || {};
        const title = entry.title || `Title for ${type}-${item.eipNo}`;
        const status = entry.status || "Unknown";

        return {
          eipNo: item.eipNo,
          type,
          title,
          status,
        };
      });

    setBookmarks([...bookmarks, ...newBookmarks]);

    toast({
      title: "Action Successful.",
      description: "Added new items to your reading list!",
      status: "success",
      duration: 5000,
      isClosable: true,
    });
  };

  return (
    <Container>
      <HStack mt="10" mb="3">
        <Heading size="lg">Shared Reading List</Heading>
        <Spacer />
        <Button onClick={addToReadingList} leftIcon={<FaRegBookmark />}>
          Bookmark all
        </Button>
      </HStack>
      {parsedItems.length > 0 ? (
        <>
          {parsedItems.map((item, index) => (
            <Box w="100%" key={index} p="1" m="2">
              <EIPGridItem eipNo={item.eipNo} type={item.type} />
            </Box>
          ))}
        </>
      ) : (
        <Text>
          No items to display. Ensure the shared link contains valid data.
        </Text>
      )}
    </Container>
  );
};

export default SharedList;
