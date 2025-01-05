"use client";

import React, { useState, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";
import {
  Box,
  VStack,
  Text,
  Heading,
  Flex,
  Circle,
  Card,
  CardBody,
} from "@chakra-ui/react";
import { GraphNode } from "@/types";
import { eipGraphData } from "@/data/eipGraphData";
import { STATUS_COLORS } from "@/utils";

const EIPGraph = () => {
  const graphData = eipGraphData;

  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

  const tooltipBg = "bg.800";
  const textColor = "gray.300";
  const subTextColor = "gray.400";

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
          return STATUS_COLORS.Final;
        case "draft":
          return STATUS_COLORS.Draft;
        case "review":
          return STATUS_COLORS.Review;
        case "last call":
          return STATUS_COLORS["Last Call"];
        case "withdrawn":
          return STATUS_COLORS.Withdrawn;
        case "stagnant":
          return STATUS_COLORS.Stagnant;
        default:
          return STATUS_COLORS.Draft;
      }
    },
    [highlightNodes]
  );

  const statusColors = {
    Final: STATUS_COLORS.Final,
    Draft: STATUS_COLORS.Draft,
    Review: STATUS_COLORS.Review,
    "Last Call": STATUS_COLORS["Last Call"],
    Withdrawn: STATUS_COLORS.Withdrawn,
    Stagnant: STATUS_COLORS.Stagnant,
  };

  return (
    <Box position="relative" h="100vh">
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
            <Heading size="md">
              {hoverNode.isERC ? "ERC" : "EIP"}-{hoverNode.eipNo}
            </Heading>
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
        graphData={graphData}
        nodeId="id"
        nodeLabel={(node) =>
          `${node.isERC ? "ERC" : "EIP"}-${node.eipNo}: ${node.title}`
        }
        nodeColor={getNodeColor}
        linkColor={(link) => (highlightLinks.has(link) ? "#ff6b6b" : "#d3d3d3")}
        linkWidth={(link) => (highlightLinks.has(link) ? 2 : 1)}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = `${node.eipNo}`;
          const fontSize = 12 / globalScale;
          ctx.font = `bold ${fontSize}px Sans-Serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          // Node circle
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, 10 / globalScale, 0, 2 * Math.PI);
          ctx.fillStyle = getNodeColor(node);
          ctx.fill();

          // Label
          ctx.fillStyle = "white";
          ctx.fillText(label, node.x ?? 0, node.y ?? 0);
        }}
        cooldownTicks={100}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
      />
    </Box>
  );
};

export default EIPGraph;
