// To enable editing "Is Milady?" checkboxes, visit:
// /milady-authors?editIsMilady=true
// Edits are persisted to localStorage. Without the param, data is read-only from milady-authors.json.

"use client";

import {
  Box,
  Button,
  Container,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Avatar,
  AvatarGroup,
  Link,
  Badge,
  Text,
  HStack,
  VStack,
  Checkbox,
  Input,
  InputGroup,
  InputLeftElement,
  Progress,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Wrap,
  WrapItem,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { Layout } from "@/components/Layout";
import {
  Suspense,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import authorsData from "@/data/authors/authors.json";
import miladyHandles from "@/data/authors/milady-authors.json";
import customAuthors from "@/data/authors/custom-authors.json";
import { EIPGridItem } from "@/components/TrendingEIPs";
import { EIPType } from "@/types";

interface Proposal {
  number: string;
  prefix: string;
  status: string;
}

interface Author {
  handle: string;
  count: number;
  finalCount: number;
  type: "handle" | "email";
  proposals: Proposal[];
  github?: string;
  twitter?: string;
}

type Filter = "all" | "milady";
type SortBy = "proposals" | "acceptance";

const STORAGE_KEY = "milady-authors";

// Build alias map: alias -> primary
const aliasMap = new Map<string, string>();
for (const entry of customAuthors.aliases) {
  for (const alias of entry.aliases) {
    aliasMap.set(alias, entry.primary);
  }
}

// Merge aliases and apply twitter overrides
function processAuthors(raw: Author[]): Author[] {
  const merged = new Map<string, Author>();

  for (const author of raw) {
    const primary = aliasMap.get(author.handle) ?? author.handle;

    if (merged.has(primary)) {
      const existing = merged.get(primary)!;
      existing.count += author.count;
      existing.finalCount += author.finalCount;
      existing.proposals = existing.proposals.concat(author.proposals);
      // Keep github/twitter from whichever entry has them
      if (!existing.github && author.github) existing.github = author.github;
      if (!existing.twitter && author.twitter) existing.twitter = author.twitter;
    } else {
      merged.set(primary, {
        ...author,
        handle: primary,
        // Use primary's github URL if this is the primary entry
        github: author.github
          ? `https://github.com/${primary}`
          : undefined,
      });
    }
  }

  // Apply twitter overrides from custom-authors.json
  const overrides = customAuthors.twitterOverrides as Record<string, string>;
  for (const [handle, twitterHandle] of Object.entries(overrides)) {
    const entry = merged.get(handle);
    if (entry) {
      entry.twitter = `https://x.com/${twitterHandle}`;
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.count - a.count);
}

function LazyAvatarGroup({ author }: { author: Author }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const twitterHandle = author.twitter?.replace("https://x.com/", "");

  return (
    <Box ref={ref} minH="32px">
      {visible && (
        <AvatarGroup size="sm" max={2} spacing={-2}>
          {author.github && (
            <Avatar
              name={author.handle}
              src={`https://github.com/${author.handle}.png?size=64`}
              title="GitHub"
            />
          )}
          {twitterHandle && (
            <Avatar
              name={twitterHandle}
              src={`https://unavatar.io/x/${twitterHandle}`}
              title="Twitter/X"
            />
          )}
        </AvatarGroup>
      )}
    </Box>
  );
}

function MiladyAuthorsContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isEditMode = searchParams.get("editIsMilady") === "true";

  const [activeFilter, setActiveFilter] = useState<Filter>(
    searchParams.get("filter") === "milady" ? "milady" : "all"
  );
  const [onlyFinal, setOnlyFinal] = useState(
    searchParams.get("status") === "final"
  );
  const [sortBy, setSortBy] = useState<SortBy>(
    searchParams.get("sort") === "acceptance" ? "acceptance" : "proposals"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [minProposals, setMinProposals] = useState(
    parseInt(searchParams.get("min") || "1") || 1
  );

  // Build URL params from current state
  const syncUrl = useCallback(
    (overrides?: { filter?: Filter; final?: boolean; sort?: SortBy; min?: number }) => {
      const filter = overrides?.filter ?? activeFilter;
      const final = overrides?.final ?? onlyFinal;
      const sort = overrides?.sort ?? sortBy;
      const min = overrides?.min ?? minProposals;

      if (overrides?.filter !== undefined) setActiveFilter(filter);
      if (overrides?.final !== undefined) setOnlyFinal(final);
      if (overrides?.sort !== undefined) setSortBy(sort);
      if (overrides?.min !== undefined) setMinProposals(min);

      const params = new URLSearchParams(searchParams.toString());
      filter === "milady" ? params.set("filter", "milady") : params.delete("filter");
      final ? params.set("status", "final") : params.delete("status");
      sort === "acceptance" ? params.set("sort", "acceptance") : params.delete("sort");
      min > 1 ? params.set("min", String(min)) : params.delete("min");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname, activeFilter, onlyFinal, sortBy, minProposals]
  );

  // Backwards-compatible wrapper
  const updateParams = useCallback(
    (filter: Filter, final: boolean, sort?: SortBy) => {
      syncUrl({ filter, final, ...(sort !== undefined ? { sort } : {}) });
    },
    [syncUrl]
  );

  // Base set from the JSON file, resolving aliases to primary handles
  const jsonMiladySet = useMemo(
    () =>
      new Set(
        (miladyHandles as string[]).map((h) => {
          const primary = aliasMap.get(h) ?? h;
          return primary.toLowerCase();
        })
      ),
    []
  );

  // Editable set only used in edit mode, seeded from localStorage
  const [editMiladySet, setEditMiladySet] = useState<Set<string>>(
    () => new Set<string>()
  );

  // Load localStorage into edit set on mount (only matters in edit mode)
  useEffect(() => {
    if (!isEditMode) return;
    try {
      const stored = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      ) as string[];
      if (stored.length > 0) {
        setEditMiladySet(new Set(stored.map((h) => h.toLowerCase())));
      } else {
        // Seed from JSON if nothing in localStorage yet
        setEditMiladySet(new Set(jsonMiladySet));
      }
    } catch {
      setEditMiladySet(new Set(jsonMiladySet));
    }
  }, [isEditMode, jsonMiladySet]);

  // Persist to localStorage only in edit mode
  useEffect(() => {
    if (!isEditMode) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(editMiladySet))
    );
  }, [editMiladySet, isEditMode]);

  // The active milady set depends on mode
  const miladySet = isEditMode ? editMiladySet : jsonMiladySet;

  const allAuthorsRaw = useMemo(
    () => processAuthors(authorsData as Author[]),
    []
  );

  // When "Only Final" is on, filter out authors with 0 final proposals and re-sort
  const allAuthors = useMemo(() => {
    if (!onlyFinal) return allAuthorsRaw;
    return allAuthorsRaw
      .filter((a) => a.finalCount > 0)
      .sort((a, b) => b.finalCount - a.finalCount);
  }, [allAuthorsRaw, onlyFinal]);

  const getCount = useCallback(
    (a: Author) => (onlyFinal ? a.finalCount : a.count),
    [onlyFinal]
  );

  const getAcceptanceRate = useCallback(
    (a: Author) => (a.count > 0 ? (a.finalCount / a.count) * 100 : 0),
    []
  );

  // Use allAuthorsRaw (unfiltered by "Only Final") so stats are always complete
  const stats = useMemo(() => {
    const miladyAuthors = allAuthorsRaw.filter((a) =>
      miladySet.has(a.handle.toLowerCase())
    );
    const nonMiladyAuthors = allAuthorsRaw.filter(
      (a) => !miladySet.has(a.handle.toLowerCase())
    );

    const sum = (arr: Author[], key: "count" | "finalCount") =>
      arr.reduce((s, a) => s + a[key], 0);

    const totalAll = sum(allAuthorsRaw, "count");
    const finalAll = sum(allAuthorsRaw, "finalCount");
    const totalMilady = sum(miladyAuthors, "count");
    const finalMilady = sum(miladyAuthors, "finalCount");
    const totalOther = sum(nonMiladyAuthors, "count");
    const finalOther = sum(nonMiladyAuthors, "finalCount");

    const rate = (final: number, total: number) =>
      total > 0 ? (final / total) * 100 : 0;

    return {
      overall: { total: totalAll, final: finalAll, rate: rate(finalAll, totalAll) },
      milady: { total: totalMilady, final: finalMilady, rate: rate(finalMilady, totalMilady) },
      other: { total: totalOther, final: finalOther, rate: rate(finalOther, totalOther) },
    };
  }, [allAuthorsRaw, miladySet]);

  const { totalProposals, miladyProposals, miladyPercent } = useMemo(() => {
    const total = allAuthors.reduce((sum, a) => sum + getCount(a), 0);
    const milady = allAuthors
      .filter((a) => miladySet.has(a.handle.toLowerCase()))
      .reduce((sum, a) => sum + getCount(a), 0);
    return {
      totalProposals: total,
      miladyProposals: milady,
      miladyPercent: total > 0 ? (milady / total) * 100 : 0,
    };
  }, [allAuthors, miladySet, getCount]);

  const filteredAuthors = useMemo(() => {
    let result =
      activeFilter === "all"
        ? [...allAuthors]
        : allAuthors.filter((a) => miladySet.has(a.handle.toLowerCase()));
    if (minProposals > 1) {
      result = result.filter((a) => getCount(a) >= minProposals);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.handle.toLowerCase().includes(q));
    }
    if (sortBy === "acceptance") {
      result = [...result].sort(
        (a, b) => getAcceptanceRate(b) - getAcceptanceRate(a) || b.finalCount - a.finalCount
      );
    }
    return result;
  }, [activeFilter, allAuthors, miladySet, sortBy, getAcceptanceRate, searchQuery, minProposals, getCount]);

  const toggleMilady = useCallback(
    (handle: string, checked: boolean) => {
      if (!isEditMode) return;
      setEditMiladySet((prev) => {
        const next = new Set(prev);
        const key = handle.toLowerCase();
        if (checked) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    [isEditMode]
  );

  // Modal for viewing author proposals
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);

  const openAuthorModal = useCallback(
    (author: Author) => {
      setSelectedAuthor(author);
      onOpen();
    },
    [onOpen]
  );

  const selectedProposals = useMemo(() => {
    if (!selectedAuthor) return [];
    const proposals = selectedAuthor.proposals;
    if (onlyFinal) return proposals.filter((p) => p.status === "Final");
    return proposals;
  }, [selectedAuthor, onlyFinal]);

  const exportMilady = useCallback(() => {
    const miladyAuthors = allAuthors
      .filter((a) => miladySet.has(a.handle.toLowerCase()))
      .map((a) => a.handle);
    navigator.clipboard.writeText(JSON.stringify(miladyAuthors, null, 2));
    toast({ title: "Copied to clipboard!", status: "success", duration: 2000 });
  }, [allAuthors, miladySet, toast]);

  return (
    <Layout>
      <Container maxW="container.xl" py={8}>
        <VStack spacing={5} align="stretch">
          <Box>
            <Heading size="lg" mb={2}>
              EIP/ERC/RIP/CAIP Authors
            </Heading>
            <Text color="whiteAlpha.600" fontSize="sm">
              {allAuthors.length} unique authors —{" "}
              <Badge colorScheme="purple" fontSize="sm">
                {miladySet.size} milady
              </Badge>
            </Text>
          </Box>

          <HStack spacing={2} flexWrap="wrap">
            <Button
              size="sm"
              variant={activeFilter === "all" ? "solid" : "outline"}
              colorScheme={activeFilter === "all" ? "blue" : "gray"}
              onClick={() => updateParams("all", onlyFinal)}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={activeFilter === "milady" ? "solid" : "outline"}
              colorScheme={activeFilter === "milady" ? "purple" : "gray"}
              onClick={() => updateParams("milady", onlyFinal)}
            >
              Only Milady
            </Button>
            <Box borderLeft="1px" borderColor="whiteAlpha.300" h="24px" />
            <Button
              size="sm"
              variant={onlyFinal ? "solid" : "outline"}
              colorScheme={onlyFinal ? "green" : "gray"}
              onClick={() => updateParams(activeFilter, !onlyFinal)}
            >
              Only Final
            </Button>
          </HStack>

          <HStack spacing={4}>
            {isEditMode && (
              <Button size="sm" colorScheme="purple" onClick={exportMilady}>
                Export Milady Authors
              </Button>
            )}
            <Text color="whiteAlpha.500" fontSize="sm">
              Showing {filteredAuthors.length} of {allAuthors.length}
            </Text>
          </HStack>

          {/* Acceptance Rate Leaderboard */}
          <Box
            bg="bg.800"
            borderRadius="lg"
            border="1px"
            borderColor="whiteAlpha.200"
            p={4}
          >
            <Text fontSize="sm" fontWeight="semibold" mb={4}>
              Acceptance Rate (Final / Proposed)
            </Text>
            <VStack spacing={3} align="stretch">
              {[
                { label: "Milady Authors", ...stats.milady, color: "purple" },
                { label: "Other Authors", ...stats.other, color: "gray" },
                { label: "Overall", ...stats.overall, color: "blue" },
              ].map((row) => (
                <Box key={row.label}>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="sm">{row.label}</Text>
                    <Text fontSize="sm" color="whiteAlpha.700">
                      {row.final} / {row.total} ({row.rate.toFixed(1)}%)
                    </Text>
                  </HStack>
                  <Progress
                    value={row.rate}
                    colorScheme={row.color}
                    borderRadius="full"
                    size="sm"
                    bg="whiteAlpha.200"
                  />
                </Box>
              ))}
            </VStack>
          </Box>

          {/* Milady share of proposals */}
          <Box
            bg="bg.800"
            borderRadius="lg"
            border="1px"
            borderColor="whiteAlpha.200"
            p={4}
          >
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" fontWeight="medium">
                Proposals by Milady authors
              </Text>
              <Text fontSize="sm" color="whiteAlpha.700">
                {miladyProposals} / {totalProposals} ({miladyPercent.toFixed(1)}
                %)
              </Text>
            </HStack>
            <Progress
              value={miladyPercent}
              colorScheme="purple"
              borderRadius="full"
              size="lg"
              bg="whiteAlpha.200"
            />
          </Box>

          <Box
            bg="bg.800"
            borderRadius="lg"
            border="1px"
            borderColor="whiteAlpha.200"
            overflowX="auto"
          >
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th w="80px" textAlign="center" whiteSpace="nowrap">
                    Milady?
                  </Th>
                  <Th w="50px">#</Th>
                  <Th w="80px"></Th>
                  <Th>
                    <HStack spacing={3}>
                      <Text>Handle</Text>
                      <InputGroup size="xs" maxW="160px">
                        <InputLeftElement pointerEvents="none" color="whiteAlpha.400">
                          🔍
                        </InputLeftElement>
                        <Input
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          variant="flushed"
                          borderColor="whiteAlpha.300"
                          _focus={{ borderColor: "blue.300" }}
                          fontWeight="normal"
                          textTransform="none"
                        />
                      </InputGroup>
                    </HStack>
                  </Th>
                  <Th
                    isNumeric
                    whiteSpace="nowrap"
                  >
                    <VStack spacing={1} align="flex-end">
                      <Text
                        cursor="pointer"
                        _hover={{ color: "white" }}
                        onClick={() =>
                          updateParams(activeFilter, onlyFinal, "proposals")
                        }
                      >
                        Proposals {sortBy === "proposals" ? "▼" : ""}
                      </Text>
                      <HStack spacing={1}>
                        <Text fontSize="xs" fontWeight="normal" textTransform="none" color="whiteAlpha.500">
                          min:
                        </Text>
                        <Input
                          size="xs"
                          type="number"
                          min={1}
                          value={minProposals}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            syncUrl({ min: val });
                          }}
                          w="40px"
                          textAlign="center"
                          variant="flushed"
                          borderColor="whiteAlpha.300"
                          _focus={{ borderColor: "blue.300" }}
                          fontWeight="normal"
                          textTransform="none"
                        />
                      </HStack>
                    </VStack>
                  </Th>
                  <Th
                    isNumeric
                    cursor="pointer"
                    whiteSpace="nowrap"
                    _hover={{ color: "white" }}
                    onClick={() =>
                      updateParams(activeFilter, onlyFinal, "acceptance")
                    }
                  >
                    Acceptance {sortBy === "acceptance" ? "▼" : ""}
                  </Th>
                  <Th>GitHub</Th>
                  <Th>Twitter / X</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredAuthors.map((author, i) => {
                  const twitterHandle = author.twitter?.replace(
                    "https://x.com/",
                    ""
                  );

                  return (
                    <Tr
                      key={author.handle}
                      _hover={{ bg: "whiteAlpha.100" }}
                    >
                      <Td textAlign="center">
                        {isEditMode ? (
                          <Checkbox
                            isChecked={miladySet.has(
                              author.handle.toLowerCase()
                            )}
                            onChange={(e) =>
                              toggleMilady(author.handle, e.target.checked)
                            }
                            colorScheme="purple"
                          />
                        ) : (
                          miladySet.has(author.handle.toLowerCase()) ? "✅" : ""
                        )}
                      </Td>
                      <Td color="whiteAlpha.500" fontSize="sm">
                        {i + 1}
                      </Td>
                      <Td>
                        <LazyAvatarGroup author={author} />
                      </Td>
                      <Td
                        fontWeight="medium"
                        cursor="pointer"
                        onClick={() => openAuthorModal(author)}
                        role="group"
                      >
                        <HStack spacing={2}>
                          <Text _groupHover={{ textDecoration: "underline" }}>
                            {author.type === "handle"
                              ? `@${author.handle}`
                              : author.handle}
                          </Text>
                          <Text
                            fontSize="xs"
                            color="blue.300"
                            opacity={0}
                            _groupHover={{ opacity: 1 }}
                            transition="opacity 0.15s"
                          >
                            View Proposals
                          </Text>
                        </HStack>
                      </Td>
                      <Td isNumeric>
                        <Badge
                          colorScheme="purple"
                          cursor="pointer"
                          _hover={{ opacity: 0.8 }}
                          onClick={() => openAuthorModal(author)}
                        >
                          {getCount(author)}
                        </Badge>
                      </Td>
                      <Td isNumeric>
                        <Text fontSize="sm" color="whiteAlpha.700">
                          {author.finalCount}/{author.count}{" "}
                          ({getAcceptanceRate(author).toFixed(0)}%)
                        </Text>
                      </Td>
                      <Td>
                        {author.github && (
                          <Link
                            href={author.github}
                            isExternal
                            color="blue.300"
                            fontSize="sm"
                          >
                            {author.github.replace(
                              "https://github.com/",
                              ""
                            )}
                          </Link>
                        )}
                      </Td>
                      <Td>
                        {author.twitter && (
                          <Link
                            href={author.twitter}
                            isExternal
                            color="blue.300"
                            fontSize="sm"
                          >
                            @{twitterHandle}
                          </Link>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        </VStack>
      </Container>

      <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent bg="bg.800">
          <ModalHeader>
            {selectedAuthor && (
              <HStack>
                <Text>
                  {selectedAuthor.type === "handle"
                    ? `@${selectedAuthor.handle}`
                    : selectedAuthor.handle}
                </Text>
                <Badge colorScheme="purple">
                  {selectedProposals.length} proposal
                  {selectedProposals.length !== 1 ? "s" : ""}
                </Badge>
                {onlyFinal && (
                  <Badge colorScheme="green">Final only</Badge>
                )}
              </HStack>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Wrap spacing={3}>
              {selectedProposals.map((p) => {
                const eipType =
                  p.prefix === "rip"
                    ? EIPType.RIP
                    : p.prefix === "caip"
                      ? EIPType.CAIP
                      : EIPType.EIP;
                return (
                  <WrapItem key={`${p.prefix}-${p.number}`}>
                    <EIPGridItem eipNo={p.number} type={eipType} />
                  </WrapItem>
                );
              })}
            </Wrap>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Layout>
  );
}

export default function MiladyAuthorsPage() {
  return (
    <Suspense>
      <MiladyAuthorsContent />
    </Suspense>
  );
}
