"use client";

import {
  Box,
  Container,
  Stack,
  VStack,
  HStack,
  Center,
  Heading,
  Link,
  Text,
  Image,
} from "@chakra-ui/react";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub, faTwitter } from "@fortawesome/free-brands-svg-icons";
import { ExternalLinkIcon } from "@chakra-ui/icons";

const Social = ({ icon, link }: { icon: IconProp; link: string }) => {
  return (
    <Link href={link} isExternal>
      <FontAwesomeIcon icon={icon} size="lg" />
    </Link>
  );
};

export const Footer = () => {
  return (
    <Box
      flexShrink={0}
      mt="6rem"
      bg={"blackAlpha.500"}
      color={"gray.200"}
      borderTop={"solid"}
      borderTopWidth={1}
      borderColor={"custom.greenDarker"}
    >
      <Container as={Stack} maxW={"8xl"} py={10}>
        <VStack spacing={3}>
          <Center flexDir={"column"}>
            <Heading size="md">
              <HStack spacing={4}>
                <Link
                  color={"white"}
                  href="https://github.com/apoorvlathey/eip-tools"
                  isExternal
                >
                  <FontAwesomeIcon icon={faGithub} size="lg" />
                </Link>
                <Link
                  href="https://farcaster.xyz/eiptools/casts-and-replies"
                  isExternal
                >
                  <Image
                    src="/farcaster-logo.svg"
                    alt="Farcaster"
                    width="2rem"
                    height="2rem"
                  />
                </Link>
              </HStack>
            </Heading>
          </Center>
          <Center flexDir={"column"}>
            <Heading size="md">
              <Social icon={faTwitter} link="https://x.com/apoorveth" />
              <Link href="https://x.com/apoorveth" isExternal>
                <Text decoration="underline" display="inline">
                  @apoorveth
                </Text>{" "}
                <ExternalLinkIcon />
              </Link>
            </Heading>
          </Center>
        </VStack>
      </Container>
    </Box>
  );
};
