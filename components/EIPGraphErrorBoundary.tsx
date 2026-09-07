"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Heading, HStack, Text, VStack } from "@chakra-ui/react";

// Renderer initialization happens in a child layout effect. Catch it here so
// unavailable WebGL (or another graph failure) cannot unmount the whole page.
export class EIPGraphErrorBoundary extends Component<
  { children: ReactNode; isEmbedded?: boolean },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("EIP graph failed to render", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <VStack
        justify="center"
        align="center"
        minH={this.props.isEmbedded ? "100%" : "100vh"}
        bg="bg.subtle"
        color="text.primary"
        spacing={4}
        p={6}
        textAlign="center"
      >
        <Heading as="h2" size="md">
          3D graph unavailable
        </Heading>
        <Text color="text.secondary" maxW="28rem" role="status">
          The graph could not start. Your browser may not support the graphics
          it needs. You can still browse and read all proposals.
        </Text>
        <HStack spacing={3} flexWrap="wrap" justify="center">
          <Button as="a" href="/eips" variant="primary">
            Browse EIPs
          </Button>
          <Button
            variant="outline"
            onClick={() => this.setState({ failed: false })}
          >
            Try again
          </Button>
          {!this.props.isEmbedded && (
            <Button as="a" href="/" variant="ghost">
              Home
            </Button>
          )}
        </HStack>
      </VStack>
    );
  }
}
