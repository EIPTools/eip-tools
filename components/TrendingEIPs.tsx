"use client";

import { useEffect, useLayoutEffect, useState } from "react";
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

const TRENDING_EIPS_CACHE_KEY = "eip-tools:trending-proposals:v1";

let trendingEIPsMemoryCache: TrendingEIP[] | undefined;

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const removeCachedTrendingEIPs = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(TRENDING_EIPS_CACHE_KEY);
  } catch {}
};

const normalizeEIPType = (type: unknown): EIPType | undefined => {
  if (type === EIPType.EIP || type === EIPType.RIP || type === EIPType.CAIP) {
    return type;
  }

  return undefined;
};

const normalizeTrendingEIPs = (data: unknown): TrendingEIP[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const eipNo =
      typeof record._id === "string" || typeof record._id === "number"
        ? String(record._id)
        : "";

    if (!eipNo) {
      return [];
    }

    const count =
      typeof record.count === "number"
        ? record.count
        : Number(record.count ?? 0);

    return [
      {
        _id: eipNo,
        count: Number.isFinite(count) ? count : 0,
        type: normalizeEIPType(record.type),
      },
    ];
  });
};

const readCachedTrendingEIPs = () => {
  if (trendingEIPsMemoryCache?.length) {
    return trendingEIPsMemoryCache;
  }

  if (typeof window === "undefined") {
    return [];
  }

  try {
    const cachedValue = window.localStorage.getItem(TRENDING_EIPS_CACHE_KEY);
    if (!cachedValue) {
      return [];
    }

    const parsedValue = JSON.parse(cachedValue) as { items?: unknown };
    const items = normalizeTrendingEIPs(parsedValue.items);

    if (!items.length) {
      removeCachedTrendingEIPs();
      return [];
    }

    trendingEIPsMemoryCache = items;
    return items;
  } catch {
    removeCachedTrendingEIPs();
    return [];
  }
};

const writeCachedTrendingEIPs = (items: TrendingEIP[]) => {
  if (!items.length || typeof window === "undefined") {
    return;
  }

  trendingEIPsMemoryCache = items;
  try {
    window.localStorage.setItem(
      TRENDING_EIPS_CACHE_KEY,
      JSON.stringify({
        updatedAt: Date.now(),
        items,
      })
    );
  } catch {}
};

export const EIPGridItem = ({
  eipNo,
  type,
  titleSize = "xl",
}: {
  eipNo: string;
  type?: EIPType;
  titleSize?: string | { base?: string; md?: string };
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
      minW={{ base: "17rem", md: "19rem" }}
      minH="8.5rem"
      p={4}
      mr={3}
      border="1px solid"
      borderColor="border.default"
      bg="bg.subtle"
      color="text.primary"
      cursor={"pointer"}
      position="relative"
      transition="background-color 0.2s ease, border-color 0.2s ease"
      _hover={{
        bg: "bg.muted",
        borderColor: "primary.500",
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
        size="sm"
        variant="ghost"
        color={isBookmarked ? "primary.400" : "text.tertiary"}
        _hover={{ color: "primary.300", bg: "whiteAlpha.100" }}
        onClick={(e) => {
          e.stopPropagation();
          toggleBookmark();
        }}
      />
      {eip ? (
        <>
          {eip.status && (
            <Badge
              px={2.5}
              py={1}
              bg={EIPStatus[eip.status]?.bg ?? "cyan.500"}
              fontWeight={600}
              rounded="md"
              color="white"
            >
              {EIPStatus[eip.status]?.prefix} {eip.status}
            </Badge>
          )}
          <Heading mt={3} pr={8} fontSize={titleSize}>
            {type === "RIP"
              ? "RIP"
              : type === "CAIP"
                ? "CAIP"
                : eip.isERC
                  ? "ERC"
                  : "EIP"}
            -{eipNo}
          </Heading>
          <Text mt={1} color="text.secondary" fontSize="sm" noOfLines={2}>
            {eip.title}
          </Text>
        </>
      ) : (
        <Heading mt={2} fontSize={titleSize}>
          EIP-{eipNo}
        </Heading>
      )}
    </Box>
  );
};

export const TrendingEIPs = () => {
  const [trendingEIPs, setTrendingEIPs] = useState<TrendingEIP[]>(
    () => trendingEIPsMemoryCache ?? []
  );

  useIsomorphicLayoutEffect(() => {
    const cachedTrendingEIPs = readCachedTrendingEIPs();
    if (cachedTrendingEIPs.length) {
      setTrendingEIPs(cachedTrendingEIPs);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchTrendingPages = async () => {
      try {
        const response = await fetch("/api/getTrendingEIPs", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const latestTrendingEIPs = normalizeTrendingEIPs(data);

        if (!latestTrendingEIPs.length) {
          return;
        }

        writeCachedTrendingEIPs(latestTrendingEIPs);

        if (isMounted) {
          setTrendingEIPs(latestTrendingEIPs);
        }
      } catch {
        // Keep cached trending proposals visible if the background refresh fails.
      }
    };

    fetchTrendingPages();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Box as="section" mt={10} px={{ base: 4, md: 6, lg: 10 }}>
      <Box maxW="container.xl" mx="auto">
        <Heading size={{ base: "xl", md: "2xl" }}>Trending proposals</Heading>
        <Text mt={1} color="text.secondary" fontSize="sm">
          Most viewed over the last 7 days
        </Text>
      </Box>
      <Box
        maxW="container.xl"
        mx="auto"
        mt={4}
        overflowX="auto"
        sx={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.18) transparent",
          "::-webkit-scrollbar": {
            h: "4px",
          },
          "::-webkit-scrollbar-track ": {
            bg: "transparent",
          },
          "::-webkit-scrollbar-thumb": {
            bg: "rgba(255,255,255,0.18)",
            rounded: "full",
          },
          "::-webkit-scrollbar-thumb:hover": {
            bg: "rgba(255,255,255,0.28)",
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
                  minW="19rem"
                  h="8.5rem"
                  p="4"
                  mr={3}
                  rounded="lg"
                  startColor="bg.subtle"
                  endColor="bg.muted"
                />
              ))}
        </Flex>
      </Box>
    </Box>
  );
};
