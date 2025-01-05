"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import {
  Box,
  VStack,
  Text,
  Heading,
  Flex,
  Circle,
  useColorModeValue,
  Card,
  CardBody,
  Input,
  InputGroup,
  InputLeftElement,
  IconButton,
} from "@chakra-ui/react";
import { GraphData, GraphNode } from "@/types";
import { eipGraphData } from "@/data/eipGraphData";
import { Search2Icon } from "@chakra-ui/icons";
import * as d3 from "d3-force";

const EIPGraph = () => {
  const graphData = eipGraphData;

  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fgRef = useRef<any>();

  const bg = useColorModeValue("white", "gray.800");
  const tooltipBg = useColorModeValue("white", "gray.700");
  const textColor = useColorModeValue("gray.600", "gray.300");
  const subTextColor = useColorModeValue("gray.500", "gray.400");

  const handleNodeClick = useCallback((node: GraphNode) => {
    window.open(`https://eip.tools/eip/${node.eipNo}`, "_blank");
  }, []);

  const handleNodeHover = useCallback(
    (node: GraphNode | null) => {
      setHighlightNodes(new Set(node ? [node] : []));
      setHighlightLinks(
        new Set(
          node
            ? graphData.links.filter(
                (link) => link.source === node.id || link.target === node.id
              )
            : []
        )
      );
      setHoverNode(node);
    },
    [graphData.links]
  );

  const getNodeColor = useCallback(
    (node: GraphNode) => {
      if (highlightNodes.has(node)) return "#ff6b6b";

      switch (node.status.toLowerCase()) {
        case "final":
          return "#2ecc71";
        case "draft":
          return "#3498db";
        case "review":
          return "#f1c40f";
        case "last call":
          return "#e67e22";
        case "withdrawn":
          return "#95a5a6";
        case "stagnant":
          return "#7f8c8d";
        default:
          return "#4a90e2";
      }
    },
    [highlightNodes]
  );

  const statusColors = {
    Final: "#2ecc71",
    Draft: "#3498db",
    Review: "#f1c40f",
    "Last Call": "#e67e22",
    Withdrawn: "#95a5a6",
    Stagnant: "#7f8c8d",
  };

  const handleFitView = () => {
    fgRef.current?.zoomToFit(400, 50);
  };

  const filteredGraphData = useMemo(() => {
    if (!searchQuery) return graphData;

    const filteredNodes = graphData.nodes.filter(
      (node) =>
        node.eipNo?.toString().includes(searchQuery) ||
        node.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const nodeIds = new Set(filteredNodes.map((node) => node.id));
    const filteredLinks = graphData.links.filter(
      (link) => nodeIds.has(link.source) && nodeIds.has(link.target)
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }, [graphData, searchQuery]);

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      // Node circle
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, 8, 0, 2 * Math.PI);
      ctx.fillStyle = getNodeColor(node);
      ctx.fill();

      // Node label
      const label = `${node.eipNo}`;
      ctx.fillStyle = "white";
      ctx.font = `${18 + 1 / globalScale}px Sans-Serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, node.x, node.y);
    },
    [getNodeColor]
  );

  return (
    <Box position="relative" h="100vh" bg={bg}>
      {/* Add Search and Zoom Controls */}
      <Flex
        position="absolute"
        top={4}
        left="50%"
        transform="translateX(-50%)"
        zIndex={10}
        gap={2}
      >
        <InputGroup w="20rem">
          <InputLeftElement>
            <Search2Icon color="gray.500" />
          </InputLeftElement>
          <Input
            placeholder="Search EIP number or title..."
            bg={tooltipBg}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>
        <IconButton
          aria-label="Fit view"
          icon={<Search2Icon />}
          onClick={handleFitView}
        />
      </Flex>

      {/* Status Legend */}
      <Card
        position="absolute"
        top={4}
        right={4}
        zIndex={10}
        size="sm"
        bg={tooltipBg}
        boxShadow="md"
      >
        <CardBody>
          <Text fontWeight="semibold" mb={2} fontSize="sm">
            Status
          </Text>
          <VStack align="stretch" spacing={1}>
            {Object.entries(statusColors).map(([status, color]) => (
              <Flex key={status} align="center" gap={2}>
                <Circle size="12px" bg={color} />
                <Text fontSize="xs">{status}</Text>
              </Flex>
            ))}
          </VStack>
        </CardBody>
      </Card>

      {/* Hover Tooltip */}
      {hoverNode && (
        <Card
          position="absolute"
          top={4}
          left={4}
          zIndex={10}
          maxW="md"
          bg={tooltipBg}
          boxShadow="md"
        >
          <CardBody>
            <Heading size="md">EIP-{hoverNode.eipNo}</Heading>
            <Text color={textColor} fontSize="sm" mt={1}>
              {hoverNode.title}
            </Text>
            <Text color={subTextColor} fontSize="xs" mt={1}>
              {hoverNode.type}{" "}
              {hoverNode.category ? `• ${hoverNode.category}` : ""} •{" "}
              {hoverNode.status}
            </Text>
          </CardBody>
        </Card>
      )}

      <ForceGraph2D
        ref={fgRef}
        graphData={filteredGraphData}
        nodeId="id"
        nodeLabel={(node: any) =>
          `${(node as GraphNode).isERC ? "ERC" : "EIP"}-${(node as GraphNode).eipNo}: ${(node as GraphNode).title}`
        }
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, 8, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={(link) => (highlightLinks.has(link) ? "#ff6b6b" : "#d3d3d3")}
        linkWidth={(link) => (highlightLinks.has(link) ? 2 : 1)}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        nodeRelSize={8}
        nodeVal={(node) => {
          const links = graphData.links.filter(
            (link) => link.source === node.id || link.target === node.id
          );
          return Math.sqrt(links.length + 1) * 2;
        }}
        d3VelocityDecay={0.1}
        cooldownTicks={1000}
        cooldownTime={15000}
        onEngineStop={() => {
          handleFitView();
        }}
      />
    </Box>
  );
};

export default EIPGraph;
