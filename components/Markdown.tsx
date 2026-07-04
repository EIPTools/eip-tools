"use client";

import NLink from "next/link";
import {
  Heading,
  Link,
  Text,
  Code,
  Divider,
  Image,
  UnorderedList,
  OrderedList,
  Checkbox,
  ListItem,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
  chakra,
  Box,
} from "@chakra-ui/react";
import { useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
// import ChakraUIRenderer from "chakra-ui-markdown-renderer"; // throwing error for <chakra.pre> and chakra factory not working, so borrowing its logic here
import { CodeBlock } from "./CodeBlock";
import {
  ProposalTableOfContents,
  type ProposalTocHeading,
} from "./ProposalTableOfContents";
import { validEIPs } from "@/data/validEIPs";
import { getCanonicalProposalHref } from "@/utils/proposalLinks";
import "katex/dist/katex.min.css";

const isRelativeURL = (url: string) => {
  // A URL is relative if it does not start with a protocol like http, https, ftp, etc.
  const absolutePattern = new RegExp("^(?:[a-z]+:)?//", "i");
  return !absolutePattern.test(url);
};

const resolveURL = (markdownFileURL: string, url: string) => {
  console.log("url", url);
  if (isRelativeURL(url)) {
    console.log("isRelativeURL", url);

    // Check if this is a GitHub raw URL
    const isGitHubRaw = markdownFileURL.includes("raw.githubusercontent.com");

    if (isGitHubRaw) {
      // Parse the GitHub URL to extract the repo and branch information
      const urlParts = markdownFileURL.split("/");
      // Format: https://raw.githubusercontent.com/owner/repo/branch/path
      if (urlParts.length >= 7) {
        const owner = urlParts[3];
        const repo = urlParts[4];
        const branch = urlParts[5];

        // Get the directory path of the current file
        const currentPath = urlParts.slice(6, urlParts.length - 1).join("/");

        // Resolve the relative path against the current path
        let resolvedPath = "";
        if (url.startsWith("../")) {
          // Count how many levels up we need to go
          let levelsUp = 0;
          let tempUrl = url;
          while (tempUrl.startsWith("../")) {
            tempUrl = tempUrl.substring(3);
            levelsUp++;
          }

          // Go up that many levels from the current path
          const currentPathParts = currentPath.split("/");
          if (levelsUp >= currentPathParts.length) {
            // We're going to the root of the repo
            resolvedPath = tempUrl;
          } else {
            const newBasePath = currentPathParts
              .slice(0, currentPathParts.length - levelsUp)
              .join("/");
            resolvedPath = newBasePath ? `${newBasePath}/${tempUrl}` : tempUrl;
          }
        } else if (url.startsWith("./")) {
          resolvedPath = `${currentPath}/${url.substring(2)}`;
        } else {
          resolvedPath = `${currentPath}/${url}`;
        }

        console.log({
          url,
          finalPath: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${resolvedPath}`,
        });

        // Check if this is an image file (common image extensions)
        const isImage = /\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(url);

        // For images, use the refs/heads/ path format that works for assets
        if (isImage) {
          // Check if the path contains something like eip-XXXX or EIP-XXXX
          const eipMatch = resolvedPath.match(
            /\/(?:assets\/)?(?:eip|EIP)-(\d+)\//i
          );
          if (eipMatch && eipMatch[1]) {
            const eipNumber = eipMatch[1];

            // Check if this EIP is actually an ERC
            const isERC = validEIPs[eipNumber]?.isERC === true;

            if (isERC) {
              // Replace eip-XXXX with erc-XXXX in the path
              resolvedPath = resolvedPath.replace(
                /\/(assets\/)?(?:eip|EIP)-(\d+)\//i,
                "/$1erc-$2/"
              );
            }
          }

          return `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/${resolvedPath}`;
        }

        // For non-images, use the standard raw format
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${resolvedPath}`;
      }
    }

    // If not a GitHub URL or couldn't parse it correctly, fall back to the original logic
    const markdownFilePath = new URL(markdownFileURL);
    const basePath = markdownFilePath.href.substring(
      0,
      markdownFilePath.href.lastIndexOf("/")
    );
    // Resolve the relative path
    return new URL(url, `${basePath}/`).href;
  }
  return url;
};

type GetCoreProps = {
  children?: ReactNode;
  "data-sourcepos"?: any;
};

function getCoreProps(props: GetCoreProps): any {
  return props["data-sourcepos"]
    ? { "data-sourcepos": props["data-sourcepos"] }
    : {};
}

const stripMarkdownFromHeading = (value: string) =>
  value
    .replace(/\\([\\`*{}[\]()#+\-.!_>])/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const slugifyHeading = (value: string) => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "section";
};

const createHeadingSlugger = () => {
  const counts = new Map<string, number>();

  return (value: string) => {
    const baseSlug = slugifyHeading(value);
    const count = counts.get(baseSlug) ?? 0;
    counts.set(baseSlug, count + 1);

    return count === 0 ? baseSlug : `${baseSlug}-${count}`;
  };
};

const extractMarkdownHeadings = (md: string): ProposalTocHeading[] => {
  const headings: ProposalTocHeading[] = [];
  const slugHeading = createHeadingSlugger();
  let inFence = false;
  let fenceMarker = "";

  md.split(/\r?\n/).forEach((line) => {
    const fenceMatch = line.match(/^ {0,3}(```+|~~~+)/);

    if (fenceMatch) {
      const marker = fenceMatch[1][0];

      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = "";
      }

      return;
    }

    if (inFence) return;

    const headingMatch = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!headingMatch) return;

    const text = stripMarkdownFromHeading(headingMatch[2]);
    if (!text) return;

    headings.push({
      id: slugHeading(text),
      level: headingMatch[1].length,
      text,
    });
  });

  return headings;
};

export const Markdown = ({
  md,
  markdownFileURL,
}: {
  md: string;
  markdownFileURL: string;
}) => {
  // Customize the markdown to properly process LaTeX blocks
  // Replace block math patterns first
  let processedMd = md;
  const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
  processedMd = processedMd.replace(
    blockMathRegex,
    (_, formula) =>
      `<div class="math-block" style="font-size: 1.2em; margin: 1em 0;">$$${formula}$$</div>`
  );

  // Then replace inline math patterns
  const inlineMathRegex = /\$((?!\$)[\s\S]*?)\$/g;
  processedMd = processedMd.replace(
    inlineMathRegex,
    (_, formula) => `$${formula}$`
  );

  const markdownHeadings = useMemo(() => extractMarkdownHeadings(md), [md]);
  const tocHeadings = useMemo(() => {
    const sectionHeadings = markdownHeadings.filter(
      (heading) => heading.level >= 2 && heading.level <= 4
    );

    return sectionHeadings.length > 0
      ? sectionHeadings
      : markdownHeadings.filter((heading) => heading.level <= 4);
  }, [markdownHeadings]);

  let headingIndex = 0;

  const renderHeading = (
    props: GetCoreProps,
    as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
    size: string
  ) => {
    const heading = markdownHeadings[headingIndex];
    headingIndex += 1;

    return (
      <Heading
        id={heading?.id ?? `section-${headingIndex}`}
        tabIndex={-1}
        scrollMarginTop="2rem"
        my={4}
        as={as}
        size={size}
        _focusVisible={{ boxShadow: "outline", outline: "none" }}
        {...getCoreProps(props)}
      >
        {props.children}
      </Heading>
    );
  };

  return (
    <Box
      display={{ base: "block", xl: "grid" }}
      gridTemplateColumns={{
        xl: "clamp(220px, 20vw, 340px) minmax(0, 1024px)",
      }}
      gap={{ xl: 8 }}
      alignItems="stretch"
      w={{
        base: "100%",
        xl: "calc(100vw - 96px)",
      }}
      ml={{
        base: 0,
        xl: "calc(24px - ((100vw - 1024px) / 2))",
      }}
    >
      <ProposalTableOfContents headings={tocHeadings} />
      <Box as="article" minW={0}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[
            rehypeRaw,
            [
              rehypeKatex,
              {
                throwOnError: false,
                output: "htmlAndMathml",
                strict: false,
              },
            ],
          ]}
          components={{
            p: (props) => {
              const { children } = props;
              return (
                <Text mb={4} color="text.secondary" lineHeight="tall">
                  {children}
                </Text>
              );
            },
            em: (props) => {
              const { children } = props;
              return <Text as="em">{children}</Text>;
            },
            blockquote: (props) => {
              const { children } = props;
              return (
                <Code
                  as="blockquote"
                  display="block"
                  p={4}
                  my={4}
                  rounded="lg"
                  bg="bg.subtle"
                  borderLeft="3px solid"
                  borderColor="primary.500"
                  color="text.secondary"
                  whiteSpace="normal"
                >
                  {children}
                </Code>
              );
            },
            code: (props) => {
              const { children, className } = props;
              // className is of the form `language-{languageName}`
              const isMultiLine = children!.toString().includes("\n");

              if (!isMultiLine) {
                return (
                  <Code
                    mt={1}
                    px={1.5}
                    py={0.5}
                    rounded="md"
                    bg="bg.muted"
                    color="text.primary"
                    fontSize="code"
                  >
                    {children}
                  </Code>
                );
              }

              const match = /language-(\w+)/.exec(className || "");
              const language = match ? match[1] : "javascript";
              return (
                <CodeBlock language={language}>{children as string}</CodeBlock>
              );
            },
            del: (props) => {
              const { children } = props;
              return <Text as="del">{children}</Text>;
            },
            hr: (props) => {
              return <Divider />;
            },
            a: (props) => {
              const url = props.href ?? "";
              const canonicalProposalHref = getCanonicalProposalHref(url);

              if (url.startsWith("#")) {
                return (
                  <Link {...props} href={url} color="primary.400">
                    {props.children}
                  </Link>
                );
              }

              if (canonicalProposalHref) {
                return (
                  <NLink href={canonicalProposalHref}>
                    <Text as="span" color="primary.400" textDecor="underline">
                      {props.children}
                    </Text>
                  </NLink>
                );
              } else {
                return (
                  <Link
                    {...props}
                    href={resolveURL(markdownFileURL, url)}
                    color="primary.400"
                    isExternal
                  />
                );
              }
            },
            img: (props) => {
              // Get the source URL with proper resolution
              const src = resolveURL(markdownFileURL, props.src as string);

              // Extract properties from props
              const { src: _, alt, ...rest } = props;

              // Get the align attribute from the HTML props
              const alignAttr = (props as any).align;

              // Map align attribute to Chakra's float property
              const floatValue =
                alignAttr === "right"
                  ? "right"
                  : alignAttr === "left"
                    ? "left"
                    : undefined;

              // Add margins based on alignment
              const marginLeft = alignAttr === "right" ? "1rem" : undefined;
              const marginRight = alignAttr === "left" ? "1rem" : undefined;

              // Define display based on if floating or not
              const display = floatValue ? "inline-block" : undefined;

              return (
                <Image
                  alt={alt as string}
                  src={src}
                  rounded="lg"
                  border="1px solid"
                  borderColor="border.default"
                  float={floatValue}
                  display={display}
                  ml={marginLeft}
                  mr={marginRight}
                  mb={floatValue ? "0.5rem" : undefined}
                  {...rest}
                />
              );
            },
            text: (props) => {
              const { children } = props;
              return <Text as="span">{children}</Text>;
            },
            ul: (props) => {
              const { children } = props;
              const attrs = getCoreProps(props);
              return (
                <UnorderedList
                  spacing={2}
                  as="ul"
                  styleType="disc"
                  pl={4}
                  color="text.secondary"
                  {...attrs}
                >
                  {children}
                </UnorderedList>
              );
            },
            ol: (props) => {
              const { children } = props;
              const attrs = getCoreProps(props);
              return (
                <OrderedList
                  spacing={2}
                  as="ol"
                  styleType="decimal"
                  pl={4}
                  color="text.secondary"
                  {...attrs}
                >
                  {children}
                </OrderedList>
              );
            },
            li: (props) => {
              const { children } = props;
              return (
                <ListItem {...getCoreProps(props)} listStyleType="inherit">
                  {children}
                </ListItem>
              );
            },
            h1: (props) => renderHeading(props, "h1", "2xl"),
            h2: (props) => renderHeading(props, "h2", "xl"),
            h3: (props) => renderHeading(props, "h3", "lg"),
            h4: (props) => renderHeading(props, "h4", "md"),
            h5: (props) => renderHeading(props, "h5", "sm"),
            h6: (props) => renderHeading(props, "h6", "xs"),
            pre: (props) => {
              const { children } = props;
              return <Box {...getCoreProps(props)}>{children}</Box>;
            },
            table: (props) => (
              <Box
                my={6}
                overflowX="auto"
                border="1px solid"
                borderColor="border.default"
                rounded="lg"
              >
                <Table variant="simple">{props.children}</Table>
              </Box>
            ),
            thead: Thead,
            tbody: Tbody,
            tr: (props) => <Tr>{props.children}</Tr>,
            td: (props) => (
              <Td borderColor="border.subtle" color="text.secondary" py={3}>
                {props.children}
              </Td>
            ),
            th: (props) => (
              <Th borderColor="border.subtle" color="text.primary" py={3}>
                {props.children}
              </Th>
            ),
          }}
        >
          {processedMd}
        </ReactMarkdown>
      </Box>
    </Box>
  );
};
