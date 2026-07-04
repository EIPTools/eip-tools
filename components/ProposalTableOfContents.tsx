"use client";

import { Box, Link, Text, VStack } from "@chakra-ui/react";
import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";

export type ProposalTocHeading = {
  id: string;
  text: string;
  level: number;
};

const rowHeight = 36;
const traceWidth = 36;
const traceDepthStep = 10;
const linkDepthIndent = 14;
const stickyTop = 16;
const activeHeadingThreshold = 64;

type TocPosition = "inline" | "fixed" | "bottom";

const clampDepth = (level: number) => Math.min(Math.max(level - 2, 0), 3);

const getTraceX = (level: number) =>
  12 + clampDepth(level) * traceDepthStep;

const getTracePoint = (heading: ProposalTocHeading, index: number) => ({
  x: getTraceX(heading.level),
  y: index * rowHeight + rowHeight / 2,
});

export const ProposalTableOfContents = ({
  headings,
}: {
  headings: ProposalTocHeading[];
}) => {
  const [activeHeading, setActiveHeading] = useState(headings[0]?.id ?? "");
  const [tocPosition, setTocPosition] = useState<TocPosition>("inline");
  const [fixedLeft, setFixedLeft] = useState(0);
  const [tocWidth, setTocWidth] = useState(0);
  const tocSlotRef = useRef<HTMLDivElement>(null);
  const tocNavRef = useRef<HTMLDivElement>(null);
  const tocHeaderRef = useRef<HTMLParagraphElement>(null);

  const trace = useMemo(() => {
    const traceHeight = Math.max(rowHeight * headings.length, rowHeight * 3);
    const headingPoints = headings.map(getTracePoint);
    const firstPoint = headingPoints[0] ?? {
      x: getTraceX(2),
      y: rowHeight / 2,
    };
    const lastPoint = headingPoints[headingPoints.length - 1] ?? {
      x: getTraceX(2),
      y: rowHeight,
    };
    const points = [
      { x: firstPoint.x, y: 0 },
      ...headingPoints,
      { x: lastPoint.x, y: traceHeight },
    ];

    return {
      height: traceHeight,
      points,
      polyline: points.map((point) => `${point.x},${point.y}`).join(" "),
    };
  }, [headings]);

  const activeIndex = Math.max(
    0,
    headings.findIndex((heading) => heading.id === activeHeading)
  );

  const activePolyline = trace.points
    .slice(0, Math.min(activeIndex + 2, trace.points.length))
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  useEffect(() => {
    if (headings.length === 0) return;

    setActiveHeading((previousHeading) =>
      headings.some((heading) => heading.id === previousHeading)
        ? previousHeading
        : headings[0].id
    );
  }, [headings]);

  useEffect(() => {
    if (headings.length === 0) return;

    const updateActiveHeading = () => {
      let currentHeading = headings[0].id;

      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (!element) continue;

        if (element.getBoundingClientRect().top <= activeHeadingThreshold) {
          currentHeading = heading.id;
        } else {
          break;
        }
      }

      setActiveHeading((previousHeading) =>
        previousHeading === currentHeading ? previousHeading : currentHeading
      );
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        updateActiveHeading();
        ticking = false;
      });
    };

    updateActiveHeading();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("load", updateActiveHeading);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("load", updateActiveHeading);
    };
  }, [headings]);

  useEffect(() => {
    if (!activeHeading) return;

    const scrollContainer = tocNavRef.current;
    if (!scrollContainer) return;

    const activeLink = Array.from(
      document.querySelectorAll<HTMLElement>(
        `[data-proposal-toc-id="${activeHeading}"]`
      )
    ).find((element) => element.getClientRects().length > 0);

    if (!activeLink) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const stickyHeaderHeight =
      tocHeaderRef.current?.getBoundingClientRect().height ?? 0;
    const linkRect = activeLink.getBoundingClientRect();
    const visibleTop = containerRect.top + stickyHeaderHeight;

    if (linkRect.top < visibleTop) {
      scrollContainer.scrollTop -= visibleTop - linkRect.top;
    } else if (linkRect.bottom > containerRect.bottom) {
      scrollContainer.scrollTop += linkRect.bottom - containerRect.bottom;
    }
  }, [activeHeading]);

  useEffect(() => {
    const updatePinnedState = () => {
      const slot = tocSlotRef.current;
      const nav = tocNavRef.current;
      if (!slot || !nav) return;

      const rect = slot.getBoundingClientRect();
      const navHeight = nav.getBoundingClientRect().height;
      setFixedLeft(rect.left);
      setTocWidth(rect.width);

      if (rect.top > stickyTop) {
        setTocPosition("inline");
      } else if (rect.bottom <= stickyTop + navHeight) {
        setTocPosition("bottom");
      } else {
        setTocPosition("fixed");
      }
    };

    let ticking = false;
    const onScrollOrResize = () => {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        updatePinnedState();
        ticking = false;
      });
    };

    updatePinnedState();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  if (headings.length === 0) return null;

  const handleHeadingClick = (
    event: MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    event.preventDefault();

    const element = document.getElementById(id);
    if (!element) return;

    const shouldReduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    window.history.pushState(null, "", `#${id}`);
    setActiveHeading(id);
    element.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
      block: "start",
    });
    element.focus({ preventScroll: true });
  };

  const renderLinks = () => (
    <VStack align="stretch" spacing={0}>
      {headings.map((heading) => {
        const isActive = heading.id === activeHeading;
        const depth = clampDepth(heading.level);
        const traceX = getTraceX(heading.level);

        return (
          <Link
            key={heading.id}
            href={`#${heading.id}`}
            title={heading.text}
            data-proposal-toc-id={heading.id}
            aria-current={isActive ? "location" : undefined}
            position="relative"
            display="flex"
            alignItems="center"
            h={`${rowHeight}px`}
            minH={`${rowHeight}px`}
            pl={`${depth * linkDepthIndent}px`}
            pr={2}
            overflow="hidden"
            borderRadius="md"
            color={isActive ? "primary.400" : "text.tertiary"}
            fontFamily="mono"
            fontSize={{ base: "xs", xl: "sm" }}
            fontWeight={isActive ? "semibold" : "normal"}
            lineHeight="short"
            textDecoration="none"
            transitionProperty="color, background-color, transform"
            transitionDuration="fast"
            _before={{
              content: '""',
              position: "absolute",
              left: `-${traceWidth - traceX}px`,
              top: "50%",
              width: isActive ? "22px" : "12px",
              height: "1px",
              bg: isActive ? "primary.400" : "border.strong",
              transform: "translateY(-50%)",
              transitionProperty: "background-color, width",
              transitionDuration: "fast",
            }}
            _hover={{
              color: isActive ? "primary.400" : "text.primary",
              bg: "whiteAlpha.50",
              textDecoration: "none",
            }}
            _focusVisible={{
              boxShadow: "outline",
              outline: "none",
            }}
            onClick={(event) => handleHeadingClick(event, heading.id)}
          >
            <Text
              as="span"
              color={isActive ? "primary.400" : "inherit"}
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {heading.text}
            </Text>
          </Link>
        );
      })}
    </VStack>
  );

  return (
    <>
      <Box
        as="details"
        display={{ base: "block", xl: "none" }}
        mb={6}
        border="1px solid"
        borderColor="border.default"
        bg="bg.subtle"
        borderRadius="lg"
      >
        <Box
          as="summary"
          cursor="pointer"
          px={4}
          py={3}
          color="text.primary"
          fontSize="sm"
          fontWeight="semibold"
          _focusVisible={{ boxShadow: "outline", outline: "none" }}
        >
          Contents
        </Box>
        <Box px={4} pb={4}>
          {renderLinks()}
        </Box>
      </Box>

      <Box
        ref={tocSlotRef}
        display={{ base: "none", xl: "block" }}
        position="relative"
        w="100%"
        minW={0}
        alignSelf="stretch"
      >
        <Box
          ref={tocNavRef}
          as="nav"
          aria-label="Proposal table of contents"
          position={
            tocPosition === "fixed"
              ? "fixed"
              : tocPosition === "bottom"
                ? "absolute"
                : "relative"
          }
          top={tocPosition === "fixed" ? `${stickyTop}px` : undefined}
          bottom={tocPosition === "bottom" ? 0 : undefined}
          left={tocPosition === "fixed" ? `${fixedLeft}px` : undefined}
          w={tocPosition === "fixed" && tocWidth > 0 ? `${tocWidth}px` : "100%"}
          maxH={`calc(100vh - ${stickyTop * 2}px)`}
          overflowY="auto"
          pr={2}
          zIndex={tocPosition === "fixed" ? 1 : undefined}
          sx={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.18) transparent",
            "&::-webkit-scrollbar": { width: "4px" },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(255,255,255,0.18)",
              borderRadius: "999px",
            },
            "&::-webkit-scrollbar-track": { background: "transparent" },
          }}
        >
          <Text
            ref={tocHeaderRef}
            position="sticky"
            top={0}
            zIndex={2}
            mb={0}
            pb={3}
            bg="bg.base"
            color="text.tertiary"
            fontFamily="mono"
            fontSize="xs"
            letterSpacing="wide"
            textTransform="uppercase"
          >
            Contents
          </Text>
          <Box
            position="relative"
            minH={`${trace.height}px`}
            pl={`${traceWidth}px`}
          >
            <Box
              as="svg"
              aria-hidden="true"
              position="absolute"
              left={0}
              top={0}
              w={`${traceWidth}px`}
              h={`${trace.height}px`}
              overflow="visible"
              color="primary.400"
            >
              <polyline
                points={trace.polyline}
                fill="none"
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={activePolyline}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </Box>
            {renderLinks()}
          </Box>
        </Box>
      </Box>
    </>
  );
};
