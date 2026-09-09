"use client";

import { Box, Button, Container, Text } from "@chakra-ui/react";

export function ProposalLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Container maxW="container.lg" py={10}>
      <Box role="alert" p={6} bg="bg.subtle" borderWidth="1px" borderColor="border.default" rounded="lg">
        <Text fontWeight="semibold">This proposal is temporarily unavailable.</Text>
        <Text mt={2} color="text.secondary">Please try loading it again in a moment.</Text>
        <Button mt={4} variant="secondary" onClick={onRetry}>Try again</Button>
      </Box>
    </Container>
  );
}
