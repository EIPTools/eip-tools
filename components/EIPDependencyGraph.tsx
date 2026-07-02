"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Badge,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Button,
  useDisclosure,
  Flex,
  Divider,
} from "@chakra-ui/react";
import { ExternalLinkIcon, RepeatIcon, AddIcon, MinusIcon } from "@chakra-ui/icons";
import { GraphNode } from "@/types";
import { eipGraphData } from "@/data/eipGraphData";
import { EIPStatus, getReferencedByEIPs } from "@/utils";
import { validEIPs } from "@/data/validEIPs";
import { colors as designColors } from "@/style/tokens";

interface EIPDependencyGraphProps {
  currentEipNo: string;
  isExpanded?: boolean;
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

const GRAPH_EDGE = "rgba(250,250,250,0.24)";
const GRAPH_EDGE_MUTED = "rgba(250,250,250,0.14)";
const NODE_TEXT = designColors.text.primary;
const NODE_MUTED_TEXT = designColors.text.secondary;

const STATUS_NODE_TONES: Record<
  string,
  {
    fill: string;
    currentFill: string;
    stroke: string;
    accent: string;
  }
> = {
  Final: {
    fill: "rgba(40,125,73,0.14)",
    currentFill: "rgba(40,125,73,0.22)",
    stroke: "rgba(74,222,128,0.36)",
    accent: "#6EE7A0",
  },
  Draft: {
    fill: "rgba(154,90,24,0.16)",
    currentFill: "rgba(154,90,24,0.24)",
    stroke: "rgba(216,166,80,0.40)",
    accent: "#D8A650",
  },
  Review: {
    fill: "rgba(154,109,22,0.16)",
    currentFill: "rgba(154,109,22,0.24)",
    stroke: "rgba(222,184,82,0.40)",
    accent: "#DEB852",
  },
  "Last Call": {
    fill: "rgba(47,125,90,0.14)",
    currentFill: "rgba(47,125,90,0.22)",
    stroke: "rgba(125,211,168,0.34)",
    accent: "#7DD3A8",
  },
  Stagnant: {
    fill: "rgba(229,62,62,0.12)",
    currentFill: "rgba(229,62,62,0.20)",
    stroke: "rgba(248,113,113,0.34)",
    accent: "#F87171",
  },
  Withdrawn: {
    fill: "rgba(149,165,166,0.12)",
    currentFill: "rgba(149,165,166,0.18)",
    stroke: "rgba(161,161,170,0.34)",
    accent: "#A1A1AA",
  },
};

const getNodeTone = (status: string) =>
  STATUS_NODE_TONES[status] ?? STATUS_NODE_TONES.Draft;

const getNodeMetrics = (isCurrent = false) => ({
  width: isCurrent ? 142 : 124,
  height: isCurrent ? 60 : 52,
  radius: 10,
});

const truncateLabel = (label: string, maxLength: number) =>
  label.length > maxLength ? `${label.substring(0, maxLength)}...` : label;

export const EIPDependencyGraph: React.FC<EIPDependencyGraphProps> = ({
  currentEipNo,
  isExpanded = false,
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const minZoom = 0.1;
  const maxZoom = 1.5;
  const zoomStep = 0.1;

  const handleRecenter = useCallback(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      // Scroll to center
      container.scrollTo({
        left: (scrollWidth - clientWidth) / 2,
        behavior: "smooth",
      });
    }
  }, []);

  const zoomAtCenter = useCallback((newZoom: number) => {
    if (!scrollContainerRef.current) {
      setZoom(newZoom);
      return;
    }

    const container = scrollContainerRef.current;
    const oldZoom = zoom;
    
    // Get current scroll position and viewport size
    const scrollLeft = container.scrollLeft;
    const clientWidth = container.clientWidth;
    
    // Calculate the center point in the current view (in graph coordinates)
    const centerXInView = scrollLeft + clientWidth / 2;
    const centerXInGraph = centerXInView / oldZoom;
    
    // Calculate new scroll position to keep the same graph point centered
    const newCenterXInView = centerXInGraph * newZoom;
    const newScrollLeft = newCenterXInView - clientWidth / 2;
    
    setZoom(newZoom);
    
    // Use requestAnimationFrame to ensure the DOM has updated with new zoom
    requestAnimationFrame(() => {
      container.scrollLeft = Math.max(0, newScrollLeft);
    });
  }, [zoom]);

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoom + zoomStep, maxZoom);
    zoomAtCenter(newZoom);
  }, [zoom, zoomAtCenter]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoom - zoomStep, minZoom);
    zoomAtCenter(newZoom);
  }, [zoom, zoomAtCenter]);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  // Center graph when expanded
  useEffect(() => {
    if (isExpanded) {
      // Small delay to ensure the DOM is fully rendered after collapse animation
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const scrollWidth = container.scrollWidth;
          const clientWidth = container.clientWidth;
          container.scrollLeft = (scrollWidth - clientWidth) / 2;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // Get current EIP data
  const currentEip = useMemo(() => {
    return eipGraphData.nodes.find((node) => node.eipNo === currentEipNo);
  }, [currentEipNo]);

  // Get required EIPs (dependencies)
  const requiredEips = useMemo(() => {
    const currentEipData = validEIPs[currentEipNo];
    if (!currentEipData?.requires) return [];
    
    return currentEipData.requires
      .map((req) => eipGraphData.nodes.find((node) => node.eipNo === req))
      .filter(Boolean) as GraphNode[];
  }, [currentEipNo]);

  // Get EIPs that reference this one (dependents)
  const referencedByEips = useMemo(() => {
    const referencedByEipNos = getReferencedByEIPs(currentEipNo, eipGraphData);
    return referencedByEipNos
      .map((eipNo) => eipGraphData.nodes.find((node) => node.eipNo === eipNo))
      .filter(Boolean) as GraphNode[];
  }, [currentEipNo]);

  // Calculate positions for hourglass layout
  const positionedNodes = useMemo((): {
    required: PositionedNode[];
    current: PositionedNode | null;
    referencedBy: PositionedNode[];
    graphHeight: number;
    graphWidth: number;
  } => {
    const minNodeSpacing = 172;
    const rowHeight = 118;
    const regularNodeHeight = getNodeMetrics(false).height;
    const currentNodeHeight = getNodeMetrics(true).height;
    const paddingX = 72;
    const paddingY = 44;

    // Calculate required width for each row
    const requiredWidth = requiredEips.length > 0 
      ? (requiredEips.length - 1) * minNodeSpacing + paddingX * 2
      : 0;
    
    const referencedByWidth = referencedByEips.length > 0
      ? (referencedByEips.length - 1) * minNodeSpacing + paddingX * 2
      : 0;

    const graphWidth = Math.max(720, requiredWidth, referencedByWidth);

    // Calculate number of rows needed
    const hasRequired = requiredEips.length > 0;
    const hasReferencedBy = referencedByEips.length > 0;
    const numRows = 1 + (hasRequired ? 1 : 0) + (hasReferencedBy ? 1 : 0);

    const graphHeight =
      paddingY * 2 + currentNodeHeight + (numRows - 1) * rowHeight;

    // Calculate starting Y to center content vertically
    let currentRow = 0;
    
    // Position required EIPs (top row if they exist)
    const requiredY = hasRequired ? paddingY + regularNodeHeight / 2 : 0;
    const required: PositionedNode[] = requiredEips.map((node, index) => {
      const totalWidth = (requiredEips.length - 1) * minNodeSpacing;
      const startX = (graphWidth - totalWidth) / 2;
      return {
        ...node,
        x: startX + index * minNodeSpacing,
        y: requiredY,
      };
    });
    if (hasRequired) currentRow++;

    // Position current EIP (middle)
    const currentY = paddingY + currentNodeHeight / 2 + currentRow * rowHeight;
    const current: PositionedNode | null = currentEip
      ? {
          ...currentEip,
          x: graphWidth / 2,
          y: currentY,
        }
      : null;
    currentRow++;

    // Position referenced-by EIPs (bottom row if they exist)
    const referencedByY =
      paddingY + regularNodeHeight / 2 + currentRow * rowHeight;
    const referencedBy: PositionedNode[] = referencedByEips.map((node, index) => {
      const totalWidth = (referencedByEips.length - 1) * minNodeSpacing;
      const startX = (graphWidth - totalWidth) / 2;
      return {
        ...node,
        x: startX + index * minNodeSpacing,
        y: referencedByY,
      };
    });

    return { required, current, referencedBy, graphHeight, graphWidth };
  }, [requiredEips, currentEip, referencedByEips]);
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node);
      onOpen();
    },
    [onOpen]
  );

  const handleOpenInNewTab = useCallback((node: GraphNode) => {
    window.open(`/eip/${node.eipNo}`, "_blank");
  }, []);

  const EIPNode: React.FC<{ node: PositionedNode; isCurrent?: boolean }> = ({
    node,
    isCurrent = false,
  }) => {
    const eipText = `${node.isERC ? "ERC" : "EIP"}-${node.eipNo}`;
    const metrics = getNodeMetrics(isCurrent);
    const tone = getNodeTone(node.status);
    const x = node.x - metrics.width / 2;
    const y = node.y - metrics.height / 2;
    const truncatedTitle = truncateLabel(node.title, isCurrent ? 18 : 15);
    const labelY = node.y - (isCurrent ? 4 : 3);
    const titleY = node.y + (isCurrent ? 17 : 15);
    const openNode = () => handleNodeClick(node);

    return (
      <g
        className={`dependency-node${isCurrent ? " is-current" : ""}`}
        tabIndex={0}
        role="button"
        aria-label={`Open ${eipText}: ${node.title}`}
        style={{ cursor: "pointer", outline: "none" }}
        onClick={openNode}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openNode();
          }
        }}
      >
        <title>{`${eipText}: ${node.title}`}</title>
        <rect
          className="dependency-node-frame"
          x={x}
          y={y}
          width={metrics.width}
          height={metrics.height}
          rx={metrics.radius}
          fill={isCurrent ? tone.currentFill : tone.fill}
          stroke={isCurrent ? tone.accent : tone.stroke}
          strokeWidth={isCurrent ? 1.5 : 1}
        />
        <text
          x={node.x}
          y={labelY}
          textAnchor="middle"
          fill={NODE_TEXT}
          fontSize={isCurrent ? "13" : "12"}
          fontWeight="700"
          fontFamily="var(--font-jetbrains-mono), 'JetBrains Mono', monospace"
          style={{ userSelect: "none" }}
        >
          {eipText}
        </text>
        <text
          x={node.x}
          y={titleY}
          textAnchor="middle"
          fill={NODE_MUTED_TEXT}
          fontSize={isCurrent ? "10.5" : "10"}
          fontWeight="500"
          style={{ userSelect: "none" }}
        >
          {truncatedTitle}
        </text>
      </g>
    );
  };

  const Arrow: React.FC<{ from: PositionedNode; to: PositionedNode }> = ({
    from,
    to,
  }) => {
    const fromMetrics = getNodeMetrics(from.eipNo === currentEipNo);
    const toMetrics = getNodeMetrics(to.eipNo === currentEipNo);
    const arrowSize = 6;

    // Create 90-degree flowchart-style arrows
    const startX = from.x;
    const startY = from.y + fromMetrics.height / 2 + 5;
    const endX = to.x;
    const endY = to.y - toMetrics.height / 2 - 5;

    // Calculate midpoint for the 90-degree bend
    const midY = startY + (endY - startY) / 2;

    return (
      <g>
        <path
          d={`M ${startX} ${startY} V ${midY} H ${endX} V ${endY - arrowSize}`}
          fill="none"
          stroke={GRAPH_EDGE}
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M ${endX} ${endY} L ${endX - arrowSize} ${endY - arrowSize * 1.5} L ${endX + arrowSize} ${endY - arrowSize * 1.5} Z`}
          fill={GRAPH_EDGE}
        />
      </g>
    );
  };

  if (!currentEip) {
    return (
      <Box p={4} textAlign="center">
        <Text color="text.tertiary">No dependency data available for this EIP.</Text>
      </Box>
    );
  }

  if (requiredEips.length === 0 && referencedByEips.length === 0) {
    return (
      <Box p={4} textAlign="center">
        <Text color="text.tertiary">
          This EIP has no dependencies or dependents in the graph.
        </Text>
      </Box>
    );
  }

  return (
    <Box w="100%">
      <Box
        border="1px solid"
        borderColor="border.default"
        borderRadius="lg"
        bg="bg.base"
        boxShadow="none"
        position="relative"
        overflow="hidden"
      >
        <Box
          ref={scrollContainerRef}
          px={{ base: 4, md: 5 }}
          py={{ base: 4, md: 5 }}
          overflowX="auto"
          overflowY="hidden"
          sx={{
            "::-webkit-scrollbar": {
              height: "4px",
            },
            "::-webkit-scrollbar-track": {
              bg: "transparent",
            },
            "::-webkit-scrollbar-thumb": {
              bg: "border.strong",
              borderRadius: "full",
              _hover: {
                bg: "text.tertiary",
              },
            },
          }}
        >
          <Box
            minWidth={`${positionedNodes.graphWidth * zoom}px`}
            width={`${positionedNodes.graphWidth * zoom}px`}
            minHeight={`${positionedNodes.graphHeight}px`}
            height={`${Math.max(positionedNodes.graphHeight, positionedNodes.graphHeight * zoom)}px`}
            mx="auto"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <svg
              width={positionedNodes.graphWidth * zoom}
              height={positionedNodes.graphHeight * zoom}
              viewBox={`0 0 ${positionedNodes.graphWidth} ${positionedNodes.graphHeight}`}
              style={{ display: "block" }}
            >
              <style>
                {`
                  .dependency-node .dependency-node-frame {
                    transition: fill 160ms ease, stroke 160ms ease;
                  }

                  .dependency-node:hover .dependency-node-frame,
                  .dependency-node:focus-visible .dependency-node-frame {
                    stroke: ${NODE_TEXT};
                  }
                `}
              </style>

              <line
                x1="0"
                y1={positionedNodes.graphHeight - 1}
                x2={positionedNodes.graphWidth}
                y2={positionedNodes.graphHeight - 1}
                stroke={GRAPH_EDGE_MUTED}
                strokeWidth="1"
              />

              {/* Render arrows from required EIPs to current EIP */}
              {positionedNodes.current &&
                positionedNodes.required.map((node, index) => (
                  <Arrow key={`req-${index}`} from={node} to={positionedNodes.current!} />
                ))}

              {/* Render arrows from current EIP to referenced-by EIPs */}
              {positionedNodes.current &&
                positionedNodes.referencedBy.map((node, index) => (
                  <Arrow key={`ref-${index}`} from={positionedNodes.current!} to={node} />
                ))}

              {/* Render required EIP nodes */}
              {positionedNodes.required.map((node, index) => (
                <EIPNode key={`req-${node.eipNo}`} node={node} />
              ))}

              {/* Render current EIP node */}
              {positionedNodes.current && (
                <EIPNode node={positionedNodes.current} isCurrent />
              )}

              {/* Render referenced-by EIP nodes */}
              {positionedNodes.referencedBy.map((node, index) => (
                <EIPNode key={`ref-${node.eipNo}`} node={node} />
              ))}
            </svg>
          </Box>
        </Box>

        <Box borderTop="1px solid" borderColor="border.subtle" bg="bg.subtle">
          <Flex
            justify="space-between"
            align="center"
            wrap="wrap"
            gap={3}
            px={{ base: 4, md: 5 }}
            py={3}
          >
            <HStack spacing={3} minW={0}>
              <Text fontSize="sm" color="text.secondary">
                Click a proposal for details
              </Text>
              <HStack
                spacing={0.5}
                bg="whiteAlpha.50"
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="md"
                p={0.5}
              >
                <Tooltip label="Zoom out" hasArrow placement="top">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={handleZoomOut}
                    isDisabled={zoom <= minZoom}
                    color="text.secondary"
                    _hover={{ bg: "whiteAlpha.100", color: "text.primary" }}
                    _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
                    px={2}
                  >
                    <MinusIcon boxSize={3} />
                  </Button>
                </Tooltip>
                <Text fontSize="xs" color="text.tertiary" minW="35px" textAlign="center" fontWeight="500">
                  {Math.round(zoom * 100)}%
                </Text>
                <Tooltip label="Zoom in" hasArrow placement="top">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={handleZoomIn}
                    isDisabled={zoom >= maxZoom}
                    color="text.secondary"
                    _hover={{ bg: "whiteAlpha.100", color: "text.primary" }}
                    _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
                    px={2}
                  >
                    <AddIcon boxSize={3} />
                  </Button>
                </Tooltip>
              </HStack>
              {(positionedNodes.graphWidth > 1000 || zoom !== 1) && (
                <Button
                  size="xs"
                  variant="secondary"
                  leftIcon={<RepeatIcon />}
                  onClick={() => {
                    handleResetZoom();
                    handleRecenter();
                  }}
                  color="text.secondary"
                >
                  {zoom !== 1 ? "Reset zoom" : "Recenter"}
                </Button>
              )}
            </HStack>
            <HStack spacing={4} color="text.tertiary">
              {requiredEips.length > 0 && (
                <Text fontSize="xs" fontWeight="500">
                  ↑ Dependencies ({requiredEips.length})
                </Text>
              )}
              {referencedByEips.length > 0 && (
                <Text fontSize="xs" fontWeight="500">
                  ↓ Dependents ({referencedByEips.length})
                </Text>
              )}
            </HStack>
          </Flex>
        </Box>
      </Box>

      {/* Metadata Modal */}
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        size="lg" 
        isCentered
        motionPreset="slideInBottom"
      >
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(10px)" />
        <ModalContent
          bg="bg.subtle"
          border="1px solid"
          borderColor="border.default"
          borderRadius="lg"
          boxShadow="lg"
          mx={4}
        >
          <ModalHeader pb={2}>
            <VStack align="start" spacing={3}>
              <Heading size="md" color="text.primary">
                {selectedNode?.isERC ? "ERC" : "EIP"}-{selectedNode?.eipNo}
              </Heading>
              <Text color="text.secondary" fontSize="lg" fontWeight="500">
                {selectedNode?.title}
              </Text>
              <HStack spacing={3}>
                <Tooltip 
                  label={EIPStatus[selectedNode?.status || ""]?.description}
                  hasArrow
                  bg="bg.emphasis"
                  color="text.primary"
                >
                  <Badge
                    px={3}
                    py={1}
                    bg={EIPStatus[selectedNode?.status || ""]?.bg ?? "cyan.500"}
                    fontWeight={700}
                    rounded="full"
                    fontSize="xs"
                    color="white"
                  >
                    {EIPStatus[selectedNode?.status || ""]?.prefix}{" "}
                    {selectedNode?.status}
                  </Badge>
                </Tooltip>
                <Badge
                  px={3}
                  py={1}
                  bg="primary.500"
                  fontWeight="bold"
                  rounded="full"
                  fontSize="xs"
                  color="white"
                >
                  Standards Track: {selectedNode?.isERC ? "ERC" : "Core"}
                </Badge>
              </HStack>
            </VStack>
            <Divider borderColor="border.subtle" mt={3} />
          </ModalHeader>
          <ModalCloseButton 
            color="text.tertiary"
            _hover={{ color: "text.primary", bg: "bg.emphasis" }}
            size="lg"
            top="1rem"
            right="1rem"
          />
          <ModalBody pb={6} pt={4}>
            {selectedNode && (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontWeight="bold" color="text.tertiary" fontSize="xs" textTransform="uppercase" letterSpacing="wide" mb={3}>
                    Description
                  </Text>
                  <Text color="text.secondary" lineHeight="1.7" fontSize="md">
                    {selectedNode.title}
                  </Text>
                </Box>

                <Button
                  w="100%"
                  variant="primary"
                  size="lg"
                  leftIcon={<ExternalLinkIcon />}
                  onClick={() => selectedNode && handleOpenInNewTab(selectedNode)}
                  _hover={{ 
                    transform: "translateY(-1px)", 
                    boxShadow: "lg",
                    bg: "primary.600"
                  }}
                  transition="all 0.2s"
                  fontWeight="600"
                  mt={2}
                >
                  View Full EIP
                </Button>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};
