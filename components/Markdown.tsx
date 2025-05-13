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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
// import ChakraUIRenderer from "chakra-ui-markdown-renderer"; // throwing error for <chakra.pre> and chakra factory not working, so borrowing its logic here
import { CodeBlock } from "./CodeBlock";
import { extractEipNumber } from "@/utils";
import { validEIPs } from "@/data/validEIPs";
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
  children?: React.ReactNode;
  "data-sourcepos"?: any;
};

function getCoreProps(props: GetCoreProps): any {
  return props["data-sourcepos"]
    ? { "data-sourcepos": props["data-sourcepos"] }
    : {};
}

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

  return (
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
          return <Text mb={2}>{children}</Text>;
        },
        em: (props) => {
          const { children } = props;
          return <Text as="em">{children}</Text>;
        },
        blockquote: (props) => {
          const { children } = props;
          return (
            <Code as="blockquote" p={2} rounded={"lg"}>
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
              <Code mt={1} p={1} rounded={"lg"}>
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

          let isEIPLink = false;
          try {
            const split = url.split("/");
            const eipPath = split.pop();
            // TODO: Add support for RIPs & CAIPs
            extractEipNumber(eipPath ? eipPath : "", "eip");
            isEIPLink = true;
          } catch {}

          if (isEIPLink) {
            return (
              <NLink href={url}>
                <Text as={"span"} color="blue.500" textDecor={"underline"}>
                  {props.children}
                </Text>
              </NLink>
            );
          } else {
            return (
              <Link
                {...props}
                href={resolveURL(markdownFileURL, url)}
                color="blue.500"
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
        h1: (props) => {
          return (
            <Heading my={4} as={`h1`} size={"2xl"} {...getCoreProps(props)}>
              {props.children}
            </Heading>
          );
        },
        h2: (props) => {
          return (
            <Heading my={4} as={`h2`} size={"xl"} {...getCoreProps(props)}>
              {props.children}
            </Heading>
          );
        },
        h3: (props) => {
          return (
            <Heading my={4} as={`h3`} size={"lg"} {...getCoreProps(props)}>
              {props.children}
            </Heading>
          );
        },
        h4: (props) => {
          return (
            <Heading my={4} as={`h4`} size={"md"} {...getCoreProps(props)}>
              {props.children}
            </Heading>
          );
        },
        h5: (props) => {
          return (
            <Heading my={4} as={`h5`} size={"sm"} {...getCoreProps(props)}>
              {props.children}
            </Heading>
          );
        },
        h6: (props) => {
          return (
            <Heading my={4} as={`h6`} size={"xs"} {...getCoreProps(props)}>
              {props.children}
            </Heading>
          );
        },
        pre: (props) => {
          const { children } = props;
          return <Code {...getCoreProps(props)}>{children}</Code>;
        },
        table: (props) => (
          <Box overflowX={"auto"}>
            <Table variant="simple">{props.children}</Table>
          </Box>
        ),
        thead: Thead,
        tbody: Tbody,
        tr: (props) => <Tr>{props.children}</Tr>,
        td: (props) => (
          <Td borderRight="1px solid" borderColor="gray.500">
            {props.children}
          </Td>
        ),
        th: (props) => (
          <Th borderRight="1px solid" borderColor="gray.500">
            {props.children}
          </Th>
        ),
      }}
    >
      {processedMd}
    </ReactMarkdown>
  );
};
