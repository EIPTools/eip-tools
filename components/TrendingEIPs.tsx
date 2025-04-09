"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Heading,
  Skeleton,
  Text,
  Flex,
  IconButton,
} from "@chakra-ui/react";
import { useLocalStorage } from "usehooks-ts";
import { FaBookmark, FaRegBookmark } from "react-icons/fa";
import { validEIPs } from "@/data/validEIPs";
import { EIPStatus } from "@/utils";
import { useTopLoaderRouter } from "@/hooks/useTopLoaderRouter";
import { EIPType } from "@/types";
import { validRIPs } from "@/data/validRIPs";
import { validCAIPs } from "@/data/validCAIPs";

interface TrendingEIP {
  _id: string;
  type?: EIPType;
  count: number;
}

export const EIPGridItem = ({
  eipNo,
  type,
}: {
  eipNo: string;
  type?: EIPType;
}) => {
  const router = useTopLoaderRouter();

  const [bookmarks, setBookmarks] = useLocalStorage<
    { eipNo: string; title: string; type?: EIPType; status?: string }[]
  >("eip-bookmarks", []);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const eip = type
    ? type === EIPType.EIP
      ? validEIPs[eipNo]
      : type === EIPType.RIP
        ? validRIPs[eipNo]
        : validCAIPs[eipNo]
    : validEIPs[eipNo];

  useEffect(() => {
    setIsBookmarked(bookmarks.some((item) => item.eipNo === eipNo));
  }, [bookmarks, eipNo]);

  const toggleBookmark = () => {
    if (isBookmarked) {
      removeBookmark(eipNo);
    } else {
      addBookmark({
        eipNo,
        title: eip?.title || "",
        type,
        status: eip?.status,
      });
    }
  };

  const addBookmark = (newBookmark: {
    eipNo: string;
    title: string;
    type?: EIPType;
    status?: string;
  }) => {
    setBookmarks([...bookmarks, newBookmark]);
  };

  const removeBookmark = (eipNo: string) => {
    const updatedBookmarks = bookmarks.filter(
      (bookmark) => bookmark.eipNo !== eipNo
    );
    setBookmarks(updatedBookmarks);
  };

  return (
    <Box
      flex={1}
      minW="15rem"
      minH="5rem"
      p="4"
      mr={"2"}
      border="2px solid"
      borderColor={"gray.500"}
      bg={"white"}
      color={"black"}
      cursor={"pointer"}
      position="relative"
      transition="all 0.1s ease-in-out"
      _hover={{
        bgColor: "gray.600",
        color: "white",
        borderColor: "blue.300",
      }}
      onClick={() => {
        router.push(
          `/${
            type === "RIP" ? "rip" : type === "CAIP" ? "caip" : "eip"
          }/${eipNo}`
        );
      }}
      rounded="lg"
    >
      <IconButton
        icon={isBookmarked ? <FaBookmark /> : <FaRegBookmark />}
        aria-label="Bookmark"
        position="absolute"
        top="2"
        right="2"
        color={isBookmarked ? "blue.500" : "gray.500"}
        _hover={{ color: isBookmarked ? "blue.400" : "gray.400" }}
        onClick={(e) => {
          e.stopPropagation();
          toggleBookmark();
        }}
      />
      {eip ? (
        <>
          {eip.status && (
            <Badge
              p={1}
              bg={EIPStatus[eip.status]?.bg ?? "cyan.500"}
              fontWeight={700}
              rounded="md"
            >
              {EIPStatus[eip.status]?.prefix} {eip.status}
            </Badge>
          )}
          <Heading mt={2} fontSize={{ sm: "25", md: "30", lg: "30" }}>
            {type === "RIP"
              ? "RIP"
              : type === "CAIP"
                ? "CAIP"
                : eip.isERC
                  ? "ERC"
                  : "EIP"}
            -{eipNo}
          </Heading>
          <Text>{eip.title}</Text>
        </>
      ) : (
        <Heading mt={2} fontSize={{ sm: "25", lg: "30" }}>
          EIP-{eipNo}
        </Heading>
      )}
    </Box>
  );
};

export const TrendingEIPs = () => {
  const [trendingEIPs, setTrendingEIPs] = useState<TrendingEIP[]>([]);

  useEffect(() => {
    const fetchTrendingPages = async () => {
      const response = await fetch("/api/getTrendingEIPs");
      const data = await response.json();
      setTrendingEIPs(data);
    };

    fetchTrendingPages();
  }, []);

  return (
    <Box mt={10} px={10}>
      <Box>
        <Heading>Trending EIPs 💹</Heading>
        <Text fontSize={"md"} fontWeight={200}>
          (Most viewed: Last 7 days)
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
          {trendingEIPs.length > 0
            ? trendingEIPs.map(({ _id: eipNo, type }) => (
                <EIPGridItem key={eipNo} eipNo={eipNo} type={type} />
              ))
            : [1, 2, 3, 4, 5].map((i) => (
                <Skeleton
                  key={i}
                  flex={1}
                  minW="20rem"
                  h="10rem"
                  p="4"
                  mr={"2"}
                  rounded="lg"
                />
              ))}
        </Flex>
      </Box>
    </Box>
  );
};
