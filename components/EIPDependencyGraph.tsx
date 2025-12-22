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
  Circle,
  Flex,
  Divider,
} from "@chakra-ui/react";
import { ExternalLinkIcon, RepeatIcon, AddIcon, MinusIcon } from "@chakra-ui/icons";
import { GraphNode } from "@/types";
import { eipGraphData } from "@/data/eipGraphData";
import { EIPStatus, getReferencedByEIPs } from "@/utils";
import { validEIPs } from "@/data/validEIPs";

interface EIPDependencyGraphProps {
  currentEipNo: string;
  isExpanded?: boolean;
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

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
    const minNodeSpacing = 140;
    const rowHeight = 120;
    const nodeRadius = 28;
    const currentNodeRadius = 35;
    const titleHeight = 25; // Space for title text below nodes
    const padding = 20;

    // Calculate required width for each row
    const requiredWidth = requiredEips.length > 0 
      ? (requiredEips.length - 1) * minNodeSpacing + 200
      : 0;
    
    const referencedByWidth = referencedByEips.length > 0
      ? (referencedByEips.length - 1) * minNodeSpacing + 200
      : 0;

    // Calculate total graph width (minimum 1000px for the container)
    const graphWidth = Math.max(1000, requiredWidth, referencedByWidth);

    // Calculate number of rows needed
    const hasRequired = requiredEips.length > 0;
    const hasReferencedBy = referencedByEips.length > 0;
    const numRows = 1 + (hasRequired ? 1 : 0) + (hasReferencedBy ? 1 : 0);

    // Calculate total content height
    const contentHeight = numRows * rowHeight + titleHeight;
    const graphHeight = contentHeight + padding * 2;

    // Calculate starting Y to center content vertically
    let currentRow = 0;
    
    // Position required EIPs (top row if they exist)
    const requiredY = hasRequired ? padding + nodeRadius + 10 : 0;
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
    const currentY = padding + currentNodeRadius + 10 + (currentRow * rowHeight);
    const current: PositionedNode | null = currentEip
      ? {
          ...currentEip,
          x: graphWidth / 2,
          y: currentY,
        }
      : null;
    currentRow++;

    // Position referenced-by EIPs (bottom row if they exist)
    const referencedByY = padding + nodeRadius + 10 + (currentRow * rowHeight);
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

  const getStatusColor = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case "final":
        return "#2ECC71";
      case "draft":
        return "#D69E2E";
      case "review":
        return "#F1C40F";
      case "last call":
        return "#38A169";
      case "withdrawn":
        return "#95A5A6";
      case "stagnant":
        return "#E53E3E";
      default:
        return "#D69E2E";
    }
  }, []);

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
    const radius = isCurrent ? 35 : 28;
    const eipText = `${node.isERC ? "ERC" : "EIP"}-${node.eipNo}`;
    
    // Truncate title to fit nicely
    const maxTitleLength = 16;
    const truncatedTitle = node.title.length > maxTitleLength
      ? `${node.title.substring(0, maxTitleLength)}...`
      : node.title;

    return (
      <g>
        {/* Drop shadow */}
        <circle
          cx={node.x + 2}
          cy={node.y + 2}
          r={radius}
          fill="rgba(0,0,0,0.3)"
        />
        
        {/* Main circle */}
        <circle
          cx={node.x}
          cy={node.y}
          r={radius}
          fill={getStatusColor(node.status)}
          stroke={isCurrent ? "#ffffff" : "#333333"}
          strokeWidth={isCurrent ? 3 : 1}
          style={{ 
            cursor: "pointer", 
            transition: "all 0.2s ease",
            filter: "brightness(1)"
          }}
          onClick={() => handleNodeClick(node)}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = "brightness(1.2)";
            e.currentTarget.style.strokeWidth = isCurrent ? "4" : "2";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "brightness(1)";
            e.currentTarget.style.strokeWidth = isCurrent ? "3" : "1";
          }}
        />
        
        {/* EIP number text - split into two lines if needed */}
        {eipText.length > 7 ? (
          <>
            <text
              x={node.x}
              y={node.y - 3}
              textAnchor="middle"
              fill="white"
              fontSize={isCurrent ? "11" : "9"}
              fontWeight="bold"
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => handleNodeClick(node)}
            >
              {node.isERC ? "ERC" : "EIP"}
            </text>
            <text
              x={node.x}
              y={node.y + 8}
              textAnchor="middle"
              fill="white"
              fontSize={isCurrent ? "11" : "9"}
              fontWeight="bold"
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => handleNodeClick(node)}
            >
              {node.eipNo}
            </text>
          </>
        ) : (
          <text
            x={node.x}
            y={node.y + 3}
            textAnchor="middle"
            fill="white"
            fontSize={isCurrent ? "12" : "10"}
            fontWeight="bold"
            style={{ cursor: "pointer", userSelect: "none" }}
            onClick={() => handleNodeClick(node)}
          >
            {eipText}
          </text>
        )}
        
        {/* Title text below circle */}
        <text
          x={node.x}
          y={node.y + radius + 18}
          textAnchor="middle"
          fill="#CCCCCC"
          fontSize="10"
          fontWeight="500"
          style={{ cursor: "pointer", userSelect: "none" }}
          onClick={() => handleNodeClick(node)}
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
    const fromRadius = from === positionedNodes.current ? 35 : 28;
    const toRadius = to === positionedNodes.current ? 35 : 28;
    const arrowSize = 8;

    // Create 90-degree flowchart-style arrows
    const startX = from.x;
    const startY = from.y + fromRadius + 3; // Start from bottom of source node
    const endX = to.x;
    const endY = to.y - toRadius - 3; // End at top of target node

    // Calculate midpoint for the 90-degree bend
    const midY = startY + (endY - startY) / 2;

    return (
      <g>
        {/* Vertical line from source node */}
        <line
          x1={startX}
          y1={startY}
          x2={startX}
          y2={midY}
          stroke="#666666"
          strokeWidth="1.5"
          opacity="0.8"
        />
        {/* Horizontal line */}
        <line
          x1={startX}
          y1={midY}
          x2={endX}
          y2={midY}
          stroke="#666666"
          strokeWidth="1.5"
          opacity="0.8"
        />
        {/* Vertical line to target node (stop before arrow head) */}
        <line
          x1={endX}
          y1={midY}
          x2={endX}
          y2={endY - arrowSize}
          stroke="#666666"
          strokeWidth="1.5"
          opacity="0.8"
        />
        {/* Arrow head - triangle pointing down */}
        <path
          d={`M ${endX} ${endY} L ${endX - arrowSize} ${endY - arrowSize * 1.5} L ${endX + arrowSize} ${endY - arrowSize * 1.5} Z`}
          fill="#666666"
          opacity="0.9"
        />
      </g>
    );
  };

  if (!currentEip) {
    return (
      <Box p={4} textAlign="center">
        <Text color="gray.500">No dependency data available for this EIP.</Text>
      </Box>
    );
  }

  if (requiredEips.length === 0 && referencedByEips.length === 0) {
    return (
      <Box p={4} textAlign="center">
        <Text color="gray.500">
          This EIP has no dependencies or dependents in the graph.
        </Text>
      </Box>
    );
  }

  return (
    <Box w="100%">
      <Box
        border="1px solid"
        borderColor="gray.600"
        borderRadius="lg"
        bg="gray.900"
        boxShadow="lg"
        position="relative"
      >
        <Box
          ref={scrollContainerRef}
          p={6}
          pb={16}
          overflowX="auto"
          overflowY="hidden"
          sx={{
            "::-webkit-scrollbar": {
              height: "8px",
            },
            "::-webkit-scrollbar-track": {
              bg: "gray.800",
              borderRadius: "md",
            },
            "::-webkit-scrollbar-thumb": {
              bg: "gray.600",
              borderRadius: "md",
              _hover: {
                bg: "gray.500",
              },
            },
          }}
        >
          <Box
            minWidth={`${positionedNodes.graphWidth * zoom}px`}
            width={`${positionedNodes.graphWidth * zoom}px`}
            minHeight={`${positionedNodes.graphHeight}px`}
            height={`${Math.max(positionedNodes.graphHeight, positionedNodes.graphHeight * zoom)}px`}
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
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
                </marker>
              </defs>

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

        {/* Fixed info bar at bottom */}
        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          bg="rgba(26, 32, 44, 0.95)"
          backdropFilter="blur(10px)"
          borderTop="1px solid"
          borderColor="whiteAlpha.200"
          borderBottomRadius="lg"
          p={4}
        >
          <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
            <HStack spacing={3}>
              <Text fontSize="sm" color="gray.300">
                Click on any node to see details
              </Text>
              <HStack spacing={1} bg="whiteAlpha.100" borderRadius="md" p={1}>
                <Tooltip label="Zoom out" hasArrow placement="top">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={handleZoomOut}
                    isDisabled={zoom <= minZoom}
                    color="gray.300"
                    _hover={{ bg: "whiteAlpha.200" }}
                    _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
                    px={2}
                  >
                    <MinusIcon boxSize={3} />
                  </Button>
                </Tooltip>
                <Text fontSize="xs" color="gray.400" minW="35px" textAlign="center" fontWeight="500">
                  {Math.round(zoom * 100)}%
                </Text>
                <Tooltip label="Zoom in" hasArrow placement="top">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={handleZoomIn}
                    isDisabled={zoom >= maxZoom}
                    color="gray.300"
                    _hover={{ bg: "whiteAlpha.200" }}
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
                  variant="outline"
                  leftIcon={<RepeatIcon />}
                  onClick={() => {
                    handleResetZoom();
                    handleRecenter();
                  }}
                  color="gray.300"
                  borderColor="gray.600"
                  _hover={{ bg: "whiteAlpha.100", borderColor: "gray.500" }}
                >
                  {zoom !== 1 ? "Reset Zoom" : "Recenter"}
                </Button>
              )}
            </HStack>
            <HStack spacing={4}>
              {requiredEips.length > 0 && (
                <Text fontSize="xs" color="gray.400" fontWeight="500">
                  ↑ Dependencies ({requiredEips.length})
                </Text>
              )}
              {referencedByEips.length > 0 && (
                <Text fontSize="xs" color="gray.400" fontWeight="500">
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
          bg="gray.800"
          border="1px solid"
          borderColor="gray.600"
          borderRadius="xl"
          boxShadow="2xl"
          mx={4}
        >
          <ModalHeader pb={2}>
            <VStack align="start" spacing={3}>
              <Heading size="md" color="white">
                {selectedNode?.isERC ? "ERC" : "EIP"}-{selectedNode?.eipNo}
              </Heading>
              <Text color="gray.300" fontSize="lg" fontWeight="500">
                {selectedNode?.title}
              </Text>
              <HStack spacing={3}>
                <Tooltip 
                  label={EIPStatus[selectedNode?.status || ""]?.description}
                  hasArrow
                  bg="gray.700"
                  color="white"
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
                  bg="blue.500"
                  fontWeight="bold"
                  rounded="full"
                  fontSize="xs"
                  color="white"
                >
                  Standards Track: {selectedNode?.isERC ? "ERC" : "Core"}
                </Badge>
              </HStack>
            </VStack>
            <Divider borderColor="gray.600" mt={3} />
          </ModalHeader>
          <ModalCloseButton 
            color="gray.400"
            _hover={{ color: "white", bg: "gray.700" }}
            size="lg"
            top="1rem"
            right="1rem"
          />
          <ModalBody pb={6} pt={4}>
            {selectedNode && (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontWeight="bold" color="gray.400" fontSize="xs" textTransform="uppercase" letterSpacing="wide" mb={3}>
                    Description
                  </Text>
                  <Text color="gray.100" lineHeight="1.7" fontSize="md">
                    {selectedNode.title}
                  </Text>
                </Box>

                <Button
                  w="100%"
                  colorScheme="blue"
                  size="lg"
                  leftIcon={<ExternalLinkIcon />}
                  onClick={() => selectedNode && handleOpenInNewTab(selectedNode)}
                  _hover={{ 
                    transform: "translateY(-1px)", 
                    boxShadow: "lg",
                    bg: "blue.500"
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
