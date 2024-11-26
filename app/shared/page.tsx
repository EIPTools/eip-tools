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
} from "@chakra-ui/react";
import { useLocalStorage } from "usehooks-ts";
import { EIPType } from "@/types";
import React, { useMemo } from "react";
import { validEIPs } from "@/data/validEIPs";
import { validRIPs } from "@/data/validRIPs";
import { validCAIPs } from "@/data/validCAIPs";
import { EIPGridItem } from "@/components/TrendingEIPs";

interface Bookmark {
  eipNo: number;
  type?: EIPType;
  title?: string;
  status?: string;
}

const SharedList = () => {
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
          const parsedEipNo = parseInt(eipNo, 10);

          if (isNaN(parsedEipNo)) {
            throw new Error(`Invalid ${type.toUpperCase()} number: ${eipNo}`);
          }

          return {
            type: type.toUpperCase() as EIPType,
            eipNo: parsedEipNo,
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
    const newBookmarks = parsedItems
      .filter((item) => {
        return !bookmarks.some(
          (bookmark) =>
            bookmark.eipNo === item.eipNo &&
            bookmark.type === item.type.toUpperCase()
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
      <VStack>
        <Heading size="lg" mt="10" mb="3">
          Shared Reading List
        </Heading>
        <Button onClick={addToReadingList} mb="5">
          Add all to Reading List
        </Button>
      </VStack>
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
