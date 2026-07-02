"use client";

import { Heading, HStack, Icon } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import type { ReactNode } from "react";

export const SectionHeading = ({
  icon,
  children,
  rightElement,
  iconPlacement = "before",
}: {
  icon: IconType;
  children: ReactNode;
  rightElement?: ReactNode;
  iconPlacement?: "before" | "after";
}) => {
  const headingIcon = (
    <Icon
      as={icon}
      boxSize={{ base: 5, md: 6 }}
      color="text.tertiary"
      flexShrink={0}
      aria-hidden
    />
  );

  return (
    <HStack align="center" spacing={2.5}>
      {iconPlacement === "before" && headingIcon}
      <Heading size={{ base: "xl", md: "2xl" }}>{children}</Heading>
      {iconPlacement === "after" && headingIcon}
      {rightElement}
    </HStack>
  );
};
