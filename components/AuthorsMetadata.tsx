"use client";

import {
  Avatar,
  Box,
  HStack,
  Link,
  LinkBox,
  LinkOverlay,
  Text,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import {
  FaGithub,
  FaSquareXTwitter,
} from "react-icons/fa6";
import { getProposalAuthorProfiles } from "@/utils";

const scrollbarStyles = {
  "::-webkit-scrollbar": {
    w: "10px",
  },
  "::-webkit-scrollbar-track ": {
    bg: "bg.muted",
    rounded: "md",
  },
  "::-webkit-scrollbar-thumb": {
    bg: "border.strong",
    rounded: "md",
  },
};

export const AuthorsMetadata = ({
  authors,
  maxHeight = "10rem",
}: {
  authors: string[];
  maxHeight?: string;
}) => {
  const profiles = getProposalAuthorProfiles(authors);

  return (
    <Box maxH={maxHeight} overflowY="auto" p="2px" sx={scrollbarStyles}>
      <Wrap spacing={2}>
        {profiles.map((author) => {
          const links = [author.github, author.twitter].filter(Boolean) as string[];
          const hasProfiles = links.length > 0;
          const singleProfileUrl = links.length === 1 ? links[0] : undefined;
          const hasMultipleProfiles = links.length > 1;

          return (
            <WrapItem key={author.raw}>
              <LinkBox
                px={2.5}
                py={2}
                position="relative"
                role="group"
                minH="3.25rem"
                bg="whiteAlpha.50"
                borderWidth="1px"
                borderColor="border.default"
                borderRadius="md"
                transition="background-color 0.15s ease, border-color 0.15s ease"
                _hover={
                  hasProfiles
                    ? {
                        bg: "whiteAlpha.100",
                        borderColor: "border.strong",
                      }
                    : undefined
                }
              >
                {singleProfileUrl && (
                  <LinkOverlay href={singleProfileUrl} isExternal />
                )}
                <Box>
                  <HStack
                    align="center"
                    spacing={2.5}
                    minH={author.handle ? undefined : "2.25rem"}
                  >
                    {author.avatarUrl && (
                      <Avatar
                        size="xs"
                        name={author.displayName}
                        src={author.avatarUrl}
                      />
                    )}
                    <Box minW={0}>
                      <Text
                        fontWeight="semibold"
                        fontSize="sm"
                        lineHeight="short"
                        noOfLines={1}
                      >
                        {author.displayName}
                      </Text>
                      {author.handle && (
                        <Text
                          color="text.tertiary"
                          fontSize="xs"
                          lineHeight="short"
                          noOfLines={1}
                        >
                          @{author.handle}
                        </Text>
                      )}
                    </Box>
                  </HStack>
                  {hasMultipleProfiles && (
                    <Box
                      maxH={0}
                      opacity={0}
                      overflow="hidden"
                      pointerEvents="none"
                      transition="max-height 0.18s ease, opacity 0.15s ease, margin-top 0.15s ease"
                      _groupHover={{
                        maxH: "3rem",
                        opacity: 1,
                        pointerEvents: "auto",
                        mt: 1.5,
                      }}
                    >
                      <HStack spacing={3} pl={8}>
                        {author.github && (
                          <Link
                            href={author.github}
                            color="primary.400"
                            display="inline-flex"
                            alignItems="center"
                            gap={1}
                            isExternal
                            aria-label={`GitHub profile for ${author.displayName}`}
                          >
                            <FaGithub />
                            <Text as="span" fontSize="xs">
                              GitHub
                            </Text>
                          </Link>
                        )}
                        {author.twitter && (
                          <Link
                            href={author.twitter}
                            color="primary.400"
                            display="inline-flex"
                            alignItems="center"
                            gap={1}
                            isExternal
                            aria-label={`X profile for ${author.displayName}`}
                          >
                            <FaSquareXTwitter />
                            <Text as="span" fontSize="xs">
                              X
                            </Text>
                          </Link>
                        )}
                      </HStack>
                    </Box>
                  )}
                </Box>
              </LinkBox>
            </WrapItem>
          );
        })}
      </Wrap>
    </Box>
  );
};
