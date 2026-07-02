"use client";

import { Alert, Text, Link, HStack, Center } from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";

export const NotificationBar = () => {
  return process.env.NEXT_PUBLIC_GITCOIN_GRANTS_ACTIVE === "true" ? (
    <Alert
      status="info"
      bg="info.bg"
      borderBottom="1px solid"
      borderColor="info.border"
      color="info.text"
      py={2}
    >
      <Center w="100%">
        <Link
          href={process.env.NEXT_PUBLIC_GITCOIN_GRANTS_LINK}
          isExternal
          _hover={{
            textDecor: "none",
          }}
        >
          <HStack>
            <Text color="info.text">Support on</Text>

            <HStack ml={-0.5} fontWeight="bold">
              <Text color="info.text">Gitcoin Grants</Text>
              <ExternalLinkIcon />
            </HStack>
          </HStack>
        </Link>
      </Center>
    </Alert>
  ) : null;
};
