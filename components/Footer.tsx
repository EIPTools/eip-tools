"use client";

import {
  Box,
  Container,
  Stack,
  VStack,
  Center,
  Heading,
  Link,
  Text,
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
              <Link
                color={"white"}
                href="https://github.com/apoorvlathey/eip-tools"
                isExternal
              >
                <FontAwesomeIcon icon={faGithub} size="lg" />
              </Link>
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
