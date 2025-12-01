"use client";

import React, { useState, useCallback, useMemo } from "react";
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
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { GraphNode } from "@/types";
import { eipGraphData } from "@/data/eipGraphData";
import { EIPStatus, getReferencedByEIPs } from "@/utils";
import { validEIPs } from "@/data/validEIPs";

interface EIPDependencyGraphProps {
  currentEipNo: string;
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

export const EIPDependencyGraph: React.FC<EIPDependencyGraphProps> = ({
  currentEipNo,
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

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
  } => {
    const graphWidth = 1000;
    const graphHeight = 400;
    const minNodeSpacing = 140;
    const rowHeight = 130;

    // Position required EIPs (top row)
    const required: PositionedNode[] = requiredEips.map((node, index) => {
      const nodeSpacing = Math.max(minNodeSpacing, 900 / Math.max(requiredEips.length, 1));
      const totalWidth = (requiredEips.length - 1) * nodeSpacing;
      const startX = (graphWidth - totalWidth) / 2;
      return {
        ...node,
        x: startX + index * nodeSpacing,
        y: 60,
      };
    });

    // Position current EIP (middle)
    const current: PositionedNode | null = currentEip
      ? {
          ...currentEip,
          x: graphWidth / 2,
          y: 60 + rowHeight,
        }
      : null;

    // Position referenced-by EIPs (bottom row)
    const referencedBy: PositionedNode[] = referencedByEips.map((node, index) => {
      const nodeSpacing = Math.max(minNodeSpacing, 900 / Math.max(referencedByEips.length, 1));
      const totalWidth = (referencedByEips.length - 1) * nodeSpacing;
      const startX = (graphWidth - totalWidth) / 2;
      return {
        ...node,
        x: startX + index * nodeSpacing,
        y: 60 + 2 * rowHeight,
      };
    });

    return { required, current, referencedBy };
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
    const arrowLength = 12;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    
    // Adjust start and end points to account for node radius
    const fromRadius = from === positionedNodes.current ? 35 : 28;
    const toRadius = to === positionedNodes.current ? 35 : 28;
    
    const startX = from.x + Math.cos(angle) * (fromRadius + 5);
    const startY = from.y + Math.sin(angle) * (fromRadius + 5);
    const endX = to.x - Math.cos(angle) * (toRadius + 5);
    const endY = to.y - Math.sin(angle) * (toRadius + 5);
    
    const arrowX1 = endX - Math.cos(angle - Math.PI / 6) * arrowLength;
    const arrowY1 = endY - Math.sin(angle - Math.PI / 6) * arrowLength;
    const arrowX2 = endX - Math.cos(angle + Math.PI / 6) * arrowLength;
    const arrowY2 = endY - Math.sin(angle + Math.PI / 6) * arrowLength;

    return (
      <g>
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="#888888"
          strokeWidth="2"
          opacity="0.8"
        />
        <polygon
          points={`${endX},${endY} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`}
          fill="#888888"
          opacity="0.8"
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
        p={6}
        bg="gray.900"
        boxShadow="lg"
      >
        <svg
          width="100%"
          height="400"
          viewBox="0 0 1000 400"
          style={{ overflow: "visible" }}
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

        <Flex mt={4} justify="space-between" align="center">
          <Text fontSize="sm" color="gray.300">
            Click on any node to see details, or open in new tab
          </Text>
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
