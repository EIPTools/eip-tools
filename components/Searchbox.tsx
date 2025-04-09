"use client";

import React, { useState, useEffect, useRef } from "react";
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
import { SearchIcon } from "@chakra-ui/icons";
import { EIPStatus, extractEipNumber } from "@/utils";
import { validEIPs } from "@/data/validEIPs";
import { validRIPs } from "@/data/validRIPs";
import { validCAIPs } from "@/data/validCAIPs";
import { useTopLoaderRouter } from "@/hooks/useTopLoaderRouter";
import { FilteredSuggestion, SearchSuggestion, EIPType } from "@/types";

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

const searchRef = React.createRef<HTMLDivElement>();

export const Searchbox = () => {
  const router = useTopLoaderRouter();

  const [userInput, setUserInput] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<
    SearchSuggestion[]
  >([]);
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  const handleSearch = (suggestion: SearchSuggestion) => {
    // suggestion = "ERC-1234: description"
    const proposalNo = suggestion.label.split("-")[1].split(":")[0];
    const subPath =
      suggestion.data.type === "RIP"
        ? "rip"
        : suggestion.data.type === "CAIP"
          ? "caip"
          : "eip";

    setIsLoading(true);
    router.push(`/${subPath}/${proposalNo}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      setSelectedIndex((prevIndex) => {
        const newIndex = (prevIndex + 1) % searchSuggestions.length;
        scrollToItem(newIndex);
        return newIndex;
      });
    } else if (e.key === "ArrowUp") {
      setSelectedIndex((prevIndex) => {
        const newIndex =
          prevIndex === 0 ? searchSuggestions.length - 1 : prevIndex - 1;
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

  return (
    <Box position="relative" ref={searchRef}>
      <InputGroup
        w={{
          base: userInput.length ? "22rem" : "20rem",
          sm: userInput.length ? "40rem" : "30rem",
          md: userInput.length ? "40rem" : "30rem",
          lg: userInput.length ? "50rem" : "30rem",
        }}
        transition="width 0.2s ease-in-out"
      >
        <Input
          placeholder="EIP / ERC / RIP / CAIP No. or title"
          value={userInput}
          onChange={(e) => {
            if (isInvalid) {
              // reset on new input
              setIsInvalid(false);
            }

            setUserInput(e.target.value);
            // Filter the valid search queries based on the user input
            let suggestions = filterSuggestions(e.target.value);
            if (e.target.value.length === 0) {
              suggestions = [];
            }

            setSearchSuggestions(
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
        <InputRightElement w="4rem">
          <Button
            mr="0.5rem"
            w="100%"
            size="sm"
            colorScheme={isInvalid ? "red" : "blue"}
            onClick={() => {}}
            isLoading={isLoading}
          >
            <SearchIcon />
          </Button>
        </InputRightElement>
      </InputGroup>
      {searchSuggestions.length > 0 && (
        <List
          ref={listRef}
          mt={2}
          border="1px"
          borderColor="gray.200"
          borderRadius="md"
          bg="white"
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
              bg: "gray.400",
              rounded: "md",
            },
            "::-webkit-scrollbar-thumb": {
              bg: "gray.500",
              rounded: "md",
            },
          }}
          display={hideSuggestions ? "none" : "block"}
        >
          {searchSuggestions.map((suggestion, index) => {
            const status = suggestion.data.status;

            return (
              <ListItem
                key={index}
                color={"black"}
                px={4}
                py={2}
                _hover={{ bg: "gray.100" }}
                bg={selectedIndex === index ? "gray.200" : "white"}
                cursor={"pointer"}
                rounded="lg"
                onClick={() => {
                  setIsLoading(true);
                  handleSearch(suggestion);
                }}
              >
                <HStack>
                  <Text>{suggestion.label}</Text>
                  <Spacer />
                  {status && (
                    <Badge
                      p={1}
                      bg={EIPStatus[status]?.bg ?? "cyan.500"}
                      fontWeight={700}
                      rounded="md"
                    >
                      {EIPStatus[status]?.prefix} {status}
                    </Badge>
                  )}
                </HStack>
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
};
