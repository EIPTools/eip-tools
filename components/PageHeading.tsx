"use client";

import { Container, Heading, Text } from "@chakra-ui/react";

/** Primary heading is rendered before client-only data, including outages. */
export function PageHeading({ title, description }: { title: string; description?: string }) {
  return (
    <Container maxW="container.lg" pt={8} px={{ base: 4, md: 6 }}>
      <Heading as="h1" size={{ base: "xl", md: "2xl" }}>{title}</Heading>
      {description && <Text mt={2} color="text.secondary" lineHeight="tall">{description}</Text>}
    </Container>
  );
}
