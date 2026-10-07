"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  InputGroup,
  Input,
  InputRightElement,
  Button,
  List,
  ListItem,
  Box,
  HStack,
  Text,
  Badge,
  Spacer,
  useBreakpointValue,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { highlightParts } from "@/utils/searchHighlight";
import { SearchIcon } from "@chakra-ui/icons";
import { EIPStatus, extractEipNumber } from "@/utils";
import { validEIPs } from "@/data/validEIPs";
import { validRIPs } from "@/data/validRIPs";
import { validCAIPs } from "@/data/validCAIPs";
import { useTopLoaderRouter } from "@/hooks/useTopLoaderRouter";
import { FilteredSuggestion, SearchSuggestion, EIPType } from "@/types";

const searchDotBounce = keyframes`
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-3px); }
`;

const combinedData: FilteredSuggestion[] = [
  ...Object.entries(validEIPs).map(([eipNo, details]) => ({
    eipNo,
    ...details,
    type: EIPType.EIP,
  })),
  ...Object.entries(validRIPs).map(([ripNo, details]) => ({
    eipNo: ripNo,
    ...details,
    type: EIPType.RIP,
  })),
  ...Object.entries(validCAIPs).map(([caipNo, details]) => ({
    eipNo: caipNo,
    ...details,
    type: EIPType.CAIP,
  })),
];

type TextSuggestion = SearchSuggestion & { href?: string; section?: string; excerpt?: string; matches?: string[] };

export const Searchbox = () => {
  const router = useTopLoaderRouter();
  const searchRef = useRef<HTMLDivElement>(null);

  const [userInput, setUserInput] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [directSuggestions, setDirectSuggestions] = useState<
    SearchSuggestion[]
  >([]);
  const [textSuggestions, setTextSuggestions] = useState<TextSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [retry, setRetry] = useState(0);
  const searchSuggestions: TextSuggestion[] = useMemo(() => [...directSuggestions.slice(0, 5), ...textSuggestions.filter(hit => !directSuggestions.slice(0, 5).some(direct => direct.label === hit.label))], [directSuggestions, textSuggestions]);
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  const handleSearch = (suggestion: TextSuggestion) => {
    // suggestion = "ERC-1234: description"
    const proposalNo = suggestion.label.split("-")[1].split(":")[0];
    const subPath =
      suggestion.data.type === "RIP"
        ? "rip"
        : suggestion.data.type === "CAIP"
          ? "caip"
          : "eip";

    setIsLoading(true);
    setHideSuggestions(true);
    router.push(suggestion.href || `/${subPath}/${proposalNo}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setHideSuggestions(true); return; }
    if (e.key === "Enter" && selectedIndex < 0) { e.preventDefault(); if (searchSuggestions[0]) handleSearch(searchSuggestions[0]); else { setHideSuggestions(false); setRetry(value => value + 1); } return; }
    if (!searchSuggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHideSuggestions(false);
      setSelectedIndex((prevIndex) => {
        const newIndex = (prevIndex + 1) % searchSuggestions.length;
        scrollToItem(newIndex);
        return newIndex;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHideSuggestions(false);
      setSelectedIndex((prevIndex) => {
        const newIndex =
          prevIndex <= 0 ? searchSuggestions.length - 1 : prevIndex - 1;
        scrollToItem(newIndex);
        return newIndex;
      });
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < searchSuggestions.length) {
        handleSearch(searchSuggestions[selectedIndex]);
      }
    }
  };

  const scrollToItem = (index: number) => {
    if (listRef.current) {
      const item = listRef.current.children[index] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    }
  };

  const handleOuterClick = (e: MouseEvent) => {
    if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
      setHideSuggestions(true);
    }
  };

  const filterSuggestions = (query: string): FilteredSuggestion[] => {
    const lowerQuery = query.toLowerCase();

    let result: FilteredSuggestion[] = [];

    // if the query is only a number, we search & put the exact match on top for EIPs, RIPs and CAIPs
    if (!isNaN(Number(lowerQuery))) {
      result = combinedData.filter(
        (item) => item.eipNo.toString() === lowerQuery
      );
    }

    // partial match for title or eipNo
    result = [
      ...result,
      ...combinedData.filter(
        (item) =>
          item.title.toLowerCase().includes(lowerQuery) ||
          item.eipNo.toString().includes(lowerQuery)
      ),
    ];

    // remove duplicates
    result = result.filter(
      (item, index, self) =>
        index ===
        self.findIndex(
          (t) =>
            t.eipNo === item.eipNo &&
            t.title === item.title &&
            t.type === item.type
        )
    );

    return result;
  };

  useEffect(() => {
    document.addEventListener("click", handleOuterClick);
    return () => {
      document.removeEventListener("click", handleOuterClick);
    };
  }, []);

  useEffect(() => {
    setSelectedIndex(-1); // Reset selected index when search suggestions change
  }, [searchSuggestions]);

  useEffect(() => {
    const query = userInput.trim();
    setTextSuggestions([]);
    setSearchError("");
    if (query.length < 2) { setIsSearching(false); return; }
    const controller = new AbortController();
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Full-text search is unavailable. Try again.");
        if (controller.signal.aborted) return;
        setTextSuggestions(result.hits.map((hit: any) => ({
          label: `${hit.label}: ${hit.title}`, href: hit.url, section: hit.section, excerpt: hit.excerpt, matches: hit.matches,
          data: { eipNo: hit.label.split("-")[1], title: hit.title, status: hit.status,
            type: hit.type === "RIP" ? EIPType.RIP : hit.type === "CAIP" ? EIPType.CAIP : EIPType.EIP,
            isERC: hit.type === "ERC" },
        })));
      } catch (error) {
        if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "Full-text search is unavailable. Try again.");
      } finally { if (!controller.signal.aborted) setIsSearching(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [userInput, retry]);

  const renderMatches = (text: string, terms?: string[]) => highlightParts(text, terms || userInput.trim().split(/\s+/)).map((part, index) => part.match
    ? <Box as="mark" key={index} fontWeight={700} color="text.primary" bg="search.matchBg" borderRadius="2px">{part.text}</Box>
    : <React.Fragment key={index}>{part.text}</React.Fragment>);

  const hasVisibleSuggestions = !hideSuggestions && userInput.trim().length > 0 && (searchSuggestions.length > 0 || userInput.trim().length >= 2);
  const searchWidth = hasVisibleSuggestions
    ? {
        base: "min(calc(100vw - 2rem), 24rem)",
        sm: "34rem",
        md: "40rem",
        lg: "50rem",
      }
    : {
        base: "min(calc(100vw - 2rem), 20rem)",
        sm: "22rem",
        md: "26rem",
        lg: "30rem",
      };
  const searchOuterRadius = "12px";
  const searchInset = "4px";
  const searchInnerRadius = `calc(${searchOuterRadius} - ${searchInset})`;

  return (
    <Box position="relative" ref={searchRef} w={searchWidth} maxW="100%">
      <InputGroup w="100%">
        <Input
          borderRadius={searchOuterRadius}
          placeholder="EIP / ERC / RIP / CAIP No., title or text"
          aria-label="Search proposals by number, title or text"
          role="combobox"
          aria-expanded={hasVisibleSuggestions}
          aria-controls="proposal-search-results"
          aria-activedescendant={selectedIndex >= 0 ? `proposal-search-result-${selectedIndex}` : undefined}
          maxLength={200}
          value={userInput}
          onChange={(e) => {
            if (isInvalid) {
              // reset on new input
              setIsInvalid(false);
            }

            setHideSuggestions(false);
            setUserInput(e.target.value);
            // Filter the valid search queries based on the user input
            let suggestions = filterSuggestions(e.target.value);
            if (e.target.value.length === 0) {
              suggestions = [];
            }

            setDirectSuggestions(
              suggestions.map((suggestion) => ({
                label: `${
                  suggestion.type === "RIP"
                    ? "RIP-"
                    : suggestion.type === "CAIP"
                      ? "CAIP-"
                      : suggestion.isERC
                        ? "ERC-"
                        : "EIP-"
                }${suggestion.eipNo}: ${suggestion.title}`,
                data: suggestion,
              }))
            );
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setHideSuggestions(false);
          }}
          isInvalid={isInvalid}
        />
        <InputRightElement
          h="100%"
          w="4rem"
          justifyContent="flex-end"
          pr={searchInset}
        >
          <Button
            h="2rem"
            w="3.5rem"
            minW="3.5rem"
            p={0}
            size="sm"
            variant={isInvalid ? "secondary" : "primary"}
            borderRadius={searchInnerRadius}
            onClick={() => { if (searchSuggestions[0]) handleSearch(searchSuggestions[selectedIndex] || searchSuggestions[0]); else { setHideSuggestions(false); setRetry(value => value + 1); } }}
            isLoading={isLoading}
            aria-label="Search proposals"
          >
            <SearchIcon />
          </Button>
        </InputRightElement>
      </InputGroup>
      {hasVisibleSuggestions && (
        <List
          ref={listRef}
          id="proposal-search-results"
          role="listbox"
          aria-label="Proposal search results"
          mt={2}
          border="1px solid"
          borderColor="border.default"
          borderRadius="lg"
          bg="bg.subtle"
          zIndex={9999}
          position="absolute"
          width="100%"
          maxHeight="20rem"
          overflowY="auto"
          sx={{
            "::-webkit-scrollbar": {
              h: "12px",
            },
            "::-webkit-scrollbar-track ": {
              bg: "bg.muted",
              rounded: "md",
            },
            "::-webkit-scrollbar-thumb": {
              bg: "border.strong",
              rounded: "md",
            },
          }}
          display={hideSuggestions ? "none" : "block"}
        >
          {searchSuggestions.map((suggestion, index) => {
            const status = suggestion.data.status;

            return (
              <ListItem
                key={suggestion.href || suggestion.label}
                id={`proposal-search-result-${index}`}
                role="option"
                aria-selected={selectedIndex === index}
                color="text.primary"
                px={4}
                py={3}
                _hover={{ bg: "bg.emphasis" }}
                bg={selectedIndex === index ? "bg.muted" : "transparent"}
                cursor={"pointer"}
                borderBottom="1px solid"
                borderColor="border.subtle"
                _last={{ borderBottom: 0 }}
                onClick={() => {
                  setIsLoading(true);
                  handleSearch(suggestion);
                }}
              >
                <HStack>
                  <Text fontSize="sm" fontWeight={600}>{renderMatches(suggestion.label, suggestion.matches)}</Text>
                  <Spacer />
                  {status && (
                    <Badge flexShrink={0}
                      px={2.5}
                      py={1}
                      bg={EIPStatus[status]?.bg ?? "cyan.500"}
                      fontWeight={700}
                      rounded="md"
                      color="white"
                    >
                      {EIPStatus[status]?.prefix} {status}
                    </Badge>
                  )}
                </HStack>
                {suggestion.section && <Text mt={1} fontSize="xs" color="text.secondary">{renderMatches(suggestion.section, suggestion.matches)}</Text>}
                {suggestion.excerpt && <Text mt={1} fontSize="sm" color="text.secondary" noOfLines={2} overflowWrap="anywhere">{renderMatches(suggestion.excerpt, suggestion.matches)}</Text>}
              </ListItem>
            );
          })}
          <Box px={4} py={3} role="status" aria-live="polite" borderTop={searchSuggestions.length ? "1px solid" : undefined} borderColor="border.subtle">
            {isSearching ? <HStack spacing={2} color="text.secondary">
              <HStack spacing="3px" aria-hidden="true" flexShrink={0}>
                {[0, 1, 2].map(index => <Box key={index} w="4px" h="4px" rounded="full" bg="currentColor"
                  animation={`${searchDotBounce} 1s ease-in-out ${index * 0.15}s infinite`}
                  sx={{ "@media (prefers-reduced-motion: reduce)": { animation: "none" } }} />)}
              </HStack>
              <Text fontSize="xs">searching across all proposals...</Text>
            </HStack> : searchError ? <Box><Text fontSize="sm" color="text.secondary">{searchError}</Text><Button variant="secondary" size="xs" mt={2} onClick={() => setRetry(value => value + 1)}>Try again</Button></Box> : !searchSuggestions.length ? <Text fontSize="sm" color="text.secondary">No proposals found.</Text> : <Text fontSize="xs" color="text.secondary">{searchSuggestions.length} results · Titles and full text</Text>}
          </Box>
        </List>
      )}
    </Box>
  );
};
