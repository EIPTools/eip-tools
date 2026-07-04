"use client";

import NLink from "next/link";
import {
  Badge,
  Box,
  Container,
  Heading,
  HStack,
  Link,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { Layout } from "@/components/Layout";
import { EIPStatus } from "@/utils";
import { formatProposalDate } from "@/utils/proposals";
import type { ProposalListItem } from "@/utils/proposals";
import { useTopLoaderRouter } from "@/hooks/useTopLoaderRouter";

export const ProposalListPage = ({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: ProposalListItem[];
}) => {
  const router = useTopLoaderRouter();

  return (
    <Layout>
      <Box as="main" px={{ base: 4, md: 6, lg: 10 }} py={{ base: 8, md: 10 }}>
        <Container maxW="container.xl" px={0}>
          <VStack align="stretch" spacing={6}>
            <Box>
              <Heading size={{ base: "xl", md: "2xl" }}>{title}</Heading>
              <HStack mt={2} spacing={3} flexWrap="wrap">
                <Text color="text.secondary" fontSize="sm">
                  {description}
                </Text>
                <Badge
                  px={2.5}
                  py={1}
                  bg="bg.emphasis"
                  color="text.secondary"
                  border="1px solid"
                  borderColor="border.default"
                  rounded="md"
                >
                  {items.length} proposals
                </Badge>
              </HStack>
            </Box>

            <Box
              border="1px solid"
              borderColor="border.default"
              bg="bg.subtle"
              rounded="lg"
              overflow="hidden"
            >
              <TableContainer maxH="calc(100vh - 15rem)" overflowY="auto">
                <Table
                  variant="simple"
                  size="sm"
                  minW="64rem"
                  sx={{ tableLayout: "fixed" }}
                >
                  <colgroup>
                    <col style={{ width: "10rem" }} />
                    <col />
                    <col style={{ width: "7rem" }} />
                    <col style={{ width: "7rem" }} />
                    <col style={{ width: "8rem" }} />
                  </colgroup>
                  <Thead
                    bg="bg.muted"
                    position="sticky"
                    top={0}
                    zIndex={1}
                  >
                    <Tr>
                      <Th>Proposal</Th>
                      <Th>Title</Th>
                      <Th>Status</Th>
                      <Th isNumeric>
                        PR
                      </Th>
                      <Th>Updated</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {items.map((item) => {
                      const statusConfig = item.status
                        ? EIPStatus[item.status]
                        : undefined;

                      return (
                        <Tr
                          key={`${item.label}-${item.markdownPath}`}
                          cursor="pointer"
                          role="link"
                          tabIndex={0}
                          _hover={{ bg: "bg.muted" }}
                          _focusVisible={{
                            bg: "bg.muted",
                            outline: "2px solid",
                            outlineColor: "primary.500",
                            outlineOffset: "-2px",
                          }}
                          onClick={() => router.push(item.href)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              router.push(item.href);
                            }
                          }}
                        >
                          <Td
                            fontSize={{ base: "sm", md: "md" }}
                            fontWeight="semibold"
                            whiteSpace="nowrap"
                          >
                            <Link
                              as={NLink}
                              href={item.href}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {item.label}
                            </Link>
                          </Td>
                          <Td>
                            <Text
                              color="text.primary"
                              fontSize={{ base: "sm", md: "md" }}
                              lineHeight="base"
                              noOfLines={2}
                            >
                              {item.title}
                            </Text>
                            {item.requires && item.requires.length > 0 && (
                              <Text
                                mt={1}
                                color="text.tertiary"
                                fontSize="xs"
                                noOfLines={1}
                              >
                                Requires {item.requires.join(", ")}
                              </Text>
                            )}
                          </Td>
                          <Td>
                            {item.status ? (
                              <Badge
                                px={2.5}
                                py={1}
                                bg={statusConfig?.bg ?? "bg.emphasis"}
                                color="white"
                                fontWeight={600}
                                rounded="md"
                              >
                                {statusConfig?.prefix
                                  ? `${statusConfig.prefix} `
                                  : ""}
                                {item.status}
                              </Badge>
                            ) : (
                              <Text color="text.tertiary">-</Text>
                            )}
                          </Td>
                          <Td isNumeric color="text.secondary">
                            {item.prNo && item.prUrl ? (
                              <Link
                                href={item.prUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                aria-label={`Open PR #${item.prNo} on GitHub`}
                              >
                                #{item.prNo}
                              </Link>
                            ) : item.prNo ? (
                              `#${item.prNo}`
                            ) : (
                              "-"
                            )}
                          </Td>
                          <Td color="text.secondary" whiteSpace="nowrap">
                            {formatProposalDate(item.timestamp)}
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </TableContainer>
            </Box>
          </VStack>
        </Container>
      </Box>
    </Layout>
  );
};
