"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import ForceGraph3D from "react-force-graph-3d";
import {
  Box,
  VStack,
  Text,
  Heading,
  Flex,
  Circle,
  Card,
  CardBody,
  IconButton,
  HStack,
  InputGroup,
  Input,
  InputRightElement,
  Button,
  List,
  ListItem,
  Spacer,
  Badge,
} from "@chakra-ui/react";
import { AddIcon, MinusIcon, SearchIcon, RepeatIcon } from "@chakra-ui/icons";
import { ForceGraphMethods } from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import * as THREE from "three";
import { Poppins } from "next/font/google";
import { GraphNode } from "@/types";
import { eipGraphData } from "@/data/eipGraphData";
import { EIPStatus, STATUS_COLORS } from "@/utils";

const poppins = Poppins({ weight: ["400", "700"], subsets: ["latin"] });

export const EIPGraph = ({
  isEmbedded = false,
  height,
  width,
}: {
  isEmbedded?: boolean;
  height?: number;
  width?: number;
}) => {
  const graphData = eipGraphData;

  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, any>>();
  const [searchInput, setSearchInput] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<Array<GraphNode>>(
    []
  );
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchSuggestionsListRef = useRef<HTMLUListElement>(null);

  const [showResetZoom, setShowResetZoom] = useState(false);

  const tooltipBg = "bg.800";
  const textColor = "gray.300";
  const subTextColor = "gray.400";

  const handleNodeClick = useCallback((node: GraphNode) => {
    window.open(`https://eip.tools/eip/${node.eipNo}`, "_blank");
  }, []);

  // const handleNodeHover = useCallback(
  //   (node: GraphNode | null) => {
  //     // setHighlightNodes(new Set(node ? [node] : []));
  //     // setHighlightLinks(
  //     //   new Set(
  //     //     node
  //     //       ? graphData.links.filter(
  //     //           (link) => link.source === node.id || link.target === node.id
  //     //         )
  //     //       : []
  //     //   )
  //     // );
  //     setHoverNode(node);
  //   },
  //   [
  //     // graphData.links
  //   ]
  // );

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

  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      const camera = graphRef.current.camera();
      const distance = 0.5; // zoom in by scaling to 50% of current distance

      // Get current position vector
      const currentPos = new THREE.Vector3(
        camera.position.x,
        camera.position.y,
        camera.position.z
      );

      // Scale the position vector relative to origin (0,0,0)
      currentPos.multiplyScalar(distance);

      graphRef.current.cameraPosition({
        x: currentPos.x,
        y: currentPos.y,
        z: currentPos.z,
      });
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      const camera = graphRef.current.camera();
      const distance = 2; // zoom out by scaling to 200% of current distance

      // Get current position vector
      const currentPos = new THREE.Vector3(
        camera.position.x,
        camera.position.y,
        camera.position.z
      );

      // Scale the position vector relative to origin (0,0,0)
      currentPos.multiplyScalar(distance);

      graphRef.current.cameraPosition({
        x: currentPos.x,
        y: currentPos.y,
        z: currentPos.z,
      });
    }
  }, []);

  const getNodeTextSize = useCallback(
    (node: GraphNode) => {
      // Count total connections for the node
      const connections = graphData.links.filter(
        (link) => link.source === node.id || link.target === node.id
      ).length;

      // Base size for nodes with minimal connections
      const baseSize = 10;
      // Increase size based on connections, but cap it
      const maxSize = 30;
      const size = Math.min(baseSize + connections * 0.5, maxSize);

      return size;
    },
    [graphData.links]
  );

  const createNodeObject = useCallback(
    (node: GraphNode) => {
      const group = new THREE.Group();

      // Adjust sizes for embedded view
      const scale = isEmbedded ? 0.5 : 1; // Scale down nodes when embedded

      // Create sphere with adjusted size
      const geometry = new THREE.SphereGeometry(8 * scale);
      const material = new THREE.MeshLambertMaterial({
        color: getNodeColor(node),
        transparent: true,
        opacity: 0.9,
      });
      const sphere = new THREE.Mesh(geometry, material);
      group.add(sphere);

      // Create text sprite with adjusted size
      const sprite = new SpriteText(`${node.eipNo}`);
      sprite.color = "white";
      const textSize = getNodeTextSize(node) * (isEmbedded ? 0.5 : 1);
      sprite.textHeight = textSize;
      sprite.fontWeight = "bold";
      sprite.fontFace = poppins.style.fontFamily;
      sprite.renderOrder = 1;
      sprite.material.depthTest = false;
      sprite.material.depthWrite = false;
      sprite.position.set(0, 0, 0);
      group.add(sprite);

      return group;
    },
    [getNodeColor, getNodeTextSize, isEmbedded]
  );

  const filterSuggestions = (query: string): GraphNode[] => {
    if (!query) return [];

    const lowerQuery = query.toLowerCase();
    let results = graphData.nodes.filter(
      (node) =>
        node.eipNo.toString().includes(lowerQuery) ||
        node.title.toLowerCase().includes(lowerQuery)
    );

    // Prioritize exact number matches
    results.sort((a, b) => {
      if (a.eipNo.toString() === query) return -1;
      if (b.eipNo.toString() === query) return 1;
      return 0;
    });

    return results.slice(0, 10); // Limit to 10 suggestions
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      setSearchSelectedIndex((prevIndex) => {
        const newIndex = (prevIndex + 1) % searchSuggestions.length;
        scrollToItem(newIndex);
        return newIndex;
      });
    } else if (e.key === "ArrowUp") {
      setSearchSelectedIndex((prevIndex) => {
        const newIndex =
          prevIndex === 0 ? searchSuggestions.length - 1 : prevIndex - 1;
        scrollToItem(newIndex);
        return newIndex;
      });
    } else if (e.key === "Enter") {
      if (
        searchSelectedIndex >= 0 &&
        searchSelectedIndex < searchSuggestions.length
      ) {
        focusNode(searchSuggestions[searchSelectedIndex]);
        setSearchInput("");
        setSearchSuggestions([]);
        setHideSuggestions(true);
      }
    }
  };

  const scrollToItem = (index: number) => {
    if (searchSuggestionsListRef.current) {
      const item = searchSuggestionsListRef.current.children[
        index
      ] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    }
  };

  const focusNode = useCallback((node: GraphNode) => {
    if (!graphRef.current) return;

    const _node = node as unknown as { x: number; y: number; z: number };

    const distance = 200;

    setShowResetZoom(true);
    graphRef.current.cameraPosition(
      {
        x: _node.x * 1.5,
        y: _node.y * 1.5,
        z: _node.z + distance,
      },
      {
        x: _node.x,
        y: _node.y,
        z: _node.z,
      },
      2000
    );
  }, []);

  useEffect(() => {
    setSearchSelectedIndex(-1); // Reset selected index when search suggestions change
  }, [searchSuggestions]);

  return (
    <Box
      position={isEmbedded ? "relative" : "relative"}
      h={isEmbedded ? "100%" : "100vh"}
    >
      {/* Status Legend */}
      <Card
        position="absolute"
        top={4}
        right={4}
        zIndex={10}
        size="sm"
        bg={tooltipBg}
        boxShadow="md"
        display={isEmbedded ? "none" : "block"}
      >
        <CardBody>
          <Text fontWeight="semibold" mb={2} fontSize="sm">
            Status
          </Text>
          <VStack align="stretch" spacing={1}>
            {Object.entries(statusColors).map(([status, color]) => (
              <Flex key={status} align="center" gap={2}>
                <Circle size="12px" bg={color} />
                <Text fontSize="xs" fontWeight={"bold"}>
                  {status}
                </Text>
              </Flex>
            ))}
          </VStack>
        </CardBody>
      </Card>

      {/* Search Box */}
      <Box position="absolute" top={4} left={4} zIndex={10} ref={searchRef}>
        <InputGroup w={{ base: "18rem", md: "24rem" }}>
          <Input
            placeholder="Search EIP/ERC number or title"
            bg="bg.900"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setSearchSuggestions(filterSuggestions(e.target.value));
              setHideSuggestions(false);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setHideSuggestions(false)}
          />
          <InputRightElement w="4rem">
            <Button size="sm" colorScheme="blue">
              <SearchIcon />
            </Button>
          </InputRightElement>
        </InputGroup>

        {searchSuggestions.length > 0 && !hideSuggestions && (
          <List
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
            {searchSuggestions.map((node, index) => (
              <ListItem
                key={index}
                px={4}
                py={2}
                _hover={{ bg: "bg.800" }}
                bg={searchSelectedIndex === index ? "bg.800" : "bg.900"}
                cursor="pointer"
                onClick={() => {
                  focusNode(node);
                  setSearchInput("");
                  setSearchSuggestions([]);
                  setHideSuggestions(true);
                }}
              >
                <HStack>
                  <Text>
                    {node.isERC ? "ERC" : "EIP"}-{node.eipNo}: {node.title}
                  </Text>
                  <Spacer />
                  {node.status && (
                    <Badge
                      p={1}
                      bg={EIPStatus[node.status]?.bg ?? "cyan.500"}
                      color="white"
                      fontWeight={700}
                      rounded="md"
                    >
                      {EIPStatus[node.status]?.prefix} {node.status}
                    </Badge>
                  )}
                </HStack>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

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

      {/* Zoom Controls */}
      <VStack position="absolute" bottom={4} right={4} zIndex={10} spacing={2}>
        {showResetZoom ? (
          <Button
            leftIcon={<RepeatIcon />}
            onClick={() => {
              setShowResetZoom(false);
              graphRef.current?.zoomToFit(1000);
            }}
            size="sm"
            colorScheme="gray"
          >
            Reset
          </Button>
        ) : (
          <>
            <IconButton
              aria-label="Zoom in"
              icon={<AddIcon />}
              onClick={handleZoomIn}
              size="sm"
              colorScheme="gray"
            />
            <IconButton
              aria-label="Zoom out"
              icon={<MinusIcon />}
              onClick={handleZoomOut}
              size="sm"
              colorScheme="gray"
            />
            <Button
              leftIcon={<RepeatIcon />}
              onClick={() => {
                graphRef.current?.zoomToFit(1000);
              }}
              size="xs"
              colorScheme="gray"
            >
              Reset
            </Button>
          </>
        )}
      </VStack>

      <ForceGraph3D
        ref={graphRef}
        backgroundColor="#111"
        graphData={graphData}
        nodeId="id"
        nodeLabel={(node) =>
          `${node.isERC ? "ERC" : "EIP"}-${node.eipNo}: ${node.title}`
        }
        nodeThreeObject={createNodeObject}
        linkColor={(link) => (highlightLinks.has(link) ? "#ff6b6b" : "#d3d3d3")}
        linkWidth={(link) => (highlightLinks.has(link) ? 3 : 1)}
        onNodeClick={handleNodeClick}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
        height={isEmbedded ? height : undefined}
        width={isEmbedded ? width : undefined}
        // Use d3 force simulation engine
        forceEngine="d3"
        // Controls how quickly node velocities decay (0-1)
        d3VelocityDecay={0.3}
        // Controls how quickly the simulation stabilizes (0-1)
        d3AlphaDecay={0.02}
        // Quality of node geometries (higher is better but slower)
        nodeResolution={32}
        // Initial simulation iterations before rendering
        warmupTicks={100}
        // Maximum simulation iterations after user interaction
        cooldownTicks={1000}
        onEngineTick={() => {
          if (!graphRef.current) return;
          const fg = graphRef.current;

          // Set repulsive force between nodes
          fg.d3Force("charge")?.strength(-150);
          // Set minimum distance between nodes to prevent overlap
          fg.d3Force("collision")?.distance(10);
          // Dynamically adjust link distances based on node connections
          fg.d3Force("link")?.distance((link: any) => {
            // Count connections for source node
            const sourceConnections = graphData.links.filter(
              (l) => l.source === link.source || l.target === link.source
            ).length;
            // Count connections for target node
            const targetConnections = graphData.links.filter(
              (l) => l.source === link.target || l.target === link.target
            ).length;
            // Increase distance for nodes with more connections
            return 10 + Math.max(sourceConnections, targetConnections) * 2;
          });
        }}
      />
    </Box>
  );
};
