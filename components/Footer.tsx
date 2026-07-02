"use client";

import {
  Box,
  Container,
  Stack,
  VStack,
  HStack,
  Heading,
  Link,
  Text,
  Image,
} from "@chakra-ui/react";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { ExternalLinkIcon } from "@chakra-ui/icons";

const Social = ({ icon, link }: { icon: IconProp; link: string }) => {
  return (
    <Link
      href={link}
      isExternal
      color="text.secondary"
      _hover={{ color: "primary.400" }}
    >
      <FontAwesomeIcon icon={icon} size="lg" />
    </Link>
  );
};

export const Footer = () => {
  return (
    <Box
      flexShrink={0}
      mt={16}
      bg="bg.base"
      color="text.secondary"
      borderTop="1px solid"
      borderColor="border.subtle"
    >
      <Container as={Stack} maxW="container.xl" py={10} px={{ base: 4, md: 6 }}>
        <Stack
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "flex-start", md: "center" }}
          spacing={8}
        >
          <VStack align="flex-start" spacing={3} maxW="36rem">
            <HStack spacing={3}>
              <Image
                src="/eth.png"
                alt="EIP.tools"
                h="2.25rem"
                w="auto"
                objectFit="contain"
                flexShrink={0}
                rounded="md"
              />
              <Heading fontWeight="semibold" fontSize="xl" color="text.primary">
                EIP.tools
              </Heading>
            </HStack>
            <Text color="text.secondary" fontSize="sm" lineHeight="tall">
              Search, read, and map Ethereum improvement proposals, ERCs, RIPs,
              and CAIPs from one focused interface.
            </Text>
          </VStack>

          <VStack align={{ base: "flex-start", md: "flex-end" }} spacing={3}>
            <HStack spacing={4}>
              <Link
                color="text.secondary"
                href="https://github.com/apoorvlathey/eip-tools"
                isExternal
                _hover={{ color: "primary.400" }}
                aria-label="EIP.tools on GitHub"
              >
                <FontAwesomeIcon icon={faGithub} size="lg" />
              </Link>
              <Link
                href="https://farcaster.xyz/eiptools/casts-and-replies"
                isExternal
                _hover={{ opacity: 0.8 }}
                aria-label="EIP.tools on Farcaster"
              >
                <Image
                  src="/farcaster-logo.svg"
                  alt="Farcaster"
                  width="1.5rem"
                  height="1.5rem"
                />
              </Link>
              <Social icon={faXTwitter} link="https://x.com/EIPTools" />
            </HStack>
            <Link
              href="https://x.com/apoorveth"
              isExternal
              color="text.secondary"
              fontSize="sm"
              _hover={{ color: "primary.400" }}
            >
              by @apoorveth <ExternalLinkIcon mx="2px" />
            </Link>
          </VStack>
        </Stack>
      </Container>
    </Box>
  );
};
