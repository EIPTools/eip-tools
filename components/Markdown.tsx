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
import { cloneElement, useMemo, type ReactNode, type ReactElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
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

// Raw proposal HTML is untrusted. Sanitize before the trusted KaTeX renderer;
// never allow upstream styles, embedded documents, SVG/MathML or event handlers.
const proposalHtmlSchema = {
  ...defaultSchema,
  tagNames: defaultSchema.tagNames?.filter(
    (tag) => tag !== "source" && tag !== "picture"
  ),
  strip: [
    ...(defaultSchema.strip ?? []),
    "iframe", "object", "embed", "svg", "math", "style", "link", "meta", "form",
  ],
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https"],
  },
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./, "math-inline", "math-display"]],
    div: [...(defaultSchema.attributes?.div ?? []), ["className", "math-block"]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className", "math", "math-inline"]],
  },
};

// Reconcile only identifiers surviving the sanitizer. Keep its clobber prefix
// on targets, and leave trusted heading/TOC IDs and unknown fragments alone.
type FragmentNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: FragmentNode[];
  position?: { start: { line: number; column: number; offset?: number } };
  renderedHeadingId?: string;
  targetAliasId?: string;
};

type SourceHeading = ProposalTocHeading & { sourceLine: number; sourceColumn: number };
type HeadingOrigins = Map<string, string>;
const headingPositionKey = (node: FragmentNode) => JSON.stringify(node.position?.start);

// Capture only original Markdown headings before raw HTML can split or insert
// heading elements. rehype-raw preserves their start (not necessarily their end).
function captureMarkdownHeadingOrigins({ headings, origins }: { headings: SourceHeading[]; origins: HeadingOrigins }) {
  return (tree: FragmentNode) => {
    origins.clear();
    const visit = (node: FragmentNode) => {
      const heading = headings.find(heading =>
        node.tagName === `h${heading.level}` &&
        heading.sourceLine === node.position?.start.line &&
        heading.sourceColumn === node.position?.start.column);
      if (heading) origins.set(headingPositionKey(node), heading.id);
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

function reconcileSanitizedFragments({ headings, origins }: { headings: SourceHeading[]; origins: HeadingOrigins }) {
  return (tree: FragmentNode) => {
    const elements: FragmentNode[] = [];
    const visit = (node: FragmentNode) => {
      if (node.type === "element") elements.push(node);
      node.children?.forEach(visit);
    };
    visit(tree);
    const trustedIds = new Set(headings.map(heading => heading.id));
    const reserved = new Set(trustedIds);
    const allocate = (base: string) => {
      let target = base;
      let suffix = 1;
      while (reserved.has(target)) target = `${base}-${suffix++}`;
      reserved.add(target);
      return target;
    };
    // Match ATX headings by source position, not render order: a raw heading
    // before an ATX heading must not steal its unchanged TOC destination.
    let headingIndex = 0;
    for (const node of elements) {
      if (!/^h[1-6]$/.test(node.tagName ?? "")) continue;
      headingIndex++;
      const key = headingPositionKey(node);
      const trustedId = origins.get(key);
      origins.delete(key); // A trusted origin is consumed exactly once.
      node.renderedHeadingId = trustedId ?? allocate(`section-${headingIndex}`);
    }
    const targets = new Map<string, string>();
    const prefixedTargets = new Map<string, string>();
    const prefix = proposalHtmlSchema.clobberPrefix ?? "user-content-";
    for (const node of elements) {
      for (const key of ["id", "name"] as const) {
        const value = node.properties?.[key];
        if (typeof value !== "string" || !value.startsWith(prefix)) continue;
        const target = allocate(value);
        node.properties![key] = target;
        // Duplicate upstream identifiers resolve to their first source target.
        if (!targets.has(value.slice(prefix.length))) targets.set(value.slice(prefix.length), target);
        if (!prefixedTargets.has(value)) prefixedTargets.set(value, target);
      }
    }
    for (const node of elements) {
      if (node.tagName !== "a") continue;
      const href = node.properties?.href;
      if (typeof href !== "string" || !href.startsWith("#")) continue;
      let fragment: string;
      try {
        fragment = decodeURIComponent(href.slice(1));
      } catch {
        continue;
      }
      if (trustedIds.has(fragment)) continue;
      const target = targets.get(fragment) ?? prefixedTargets.get(fragment);
      if (target) node.properties!.href = `#${encodeURIComponent(target)}`;
    }
    // Only anchors implement HTML's legacy named-target behavior. For every
    // other tag, use real IDs, preserving a second authored target as an empty
    // inline alias. Keep structural aliases inside existing cells/list items.
    const normalizeNames = (parent: FragmentNode) => {
      parent.children = parent.children?.flatMap(node => {
        normalizeNames(node);
        const name = node.properties?.name;
        if (node.tagName === "a" || typeof name !== "string") return [node];
        delete node.properties!.name;
        if (!node.properties!.id) {
          node.properties!.id = name;
          return [node];
        }
        if (node.tagName === "code") {
          node.targetAliasId = name;
          return [node];
        }
        const alias: FragmentNode = { type: "element", tagName: "span", properties: { id: name }, children: [] };
        if (["img", "hr", "input", "br", "wbr"].includes(node.tagName ?? "")) return [node, alias];
        if (["table", "thead", "tbody", "tfoot", "tr", "ul", "ol"].includes(node.tagName ?? "")) {
          const findContainer = (scope: FragmentNode): FragmentNode | undefined => {
            if (["td", "th", "li"].includes(scope.tagName ?? "")) return scope;
            for (const child of scope.children ?? []) {
              const result = findContainer(child);
              if (result) return result;
            }
          };
          const container = findContainer(node);
          if (container) container.children = [alias, ...(container.children ?? [])];
          // Empty structural elements have no valid inline child. Bubble their
          // alias to the nearest flow container rather than creating rows/items.
          else node.targetAliasId = name;
        } else node.children = [alias, ...(node.children ?? [])];
        return [node];
      });
      if (["table", "thead", "tbody", "tfoot", "tr", "ul", "ol"].includes(parent.tagName ?? "")) return;
      const takeStructuralAliases = (scope: FragmentNode): FragmentNode[] => {
        const aliases: FragmentNode[] = [];
        for (const child of scope.children ?? []) {
          if (!["table", "thead", "tbody", "tfoot", "tr", "ul", "ol"].includes(child.tagName ?? "")) continue;
          if (child.targetAliasId) {
            aliases.push({ type: "element", tagName: "span", properties: { id: child.targetAliasId }, children: [] });
            delete child.targetAliasId;
          }
          aliases.push(...takeStructuralAliases(child));
        }
        return aliases;
      };
      parent.children = [...takeStructuralAliases(parent), ...(parent.children ?? [])];
    };
    normalizeNames(tree);
    // KaTeX replaces an entire math element (or language-math pre scope),
    // including its attributes. Keep allocated targets outside that scope in
    // an unstyled inline/block container; aliases add no visible text/spacing.
    const protectMathTargets = (parent: FragmentNode) => {
      parent.children = parent.children?.map(node => {
        const classes = node.properties?.className;
        const isMath = Array.isArray(classes) && classes.some(value =>
          ["language-math", "math-inline", "math-display"].includes(String(value)));
        const isMathPre = node.tagName === "pre" && node.children?.some(child =>
          child.tagName === "code" && Array.isArray(child.properties?.className) &&
          child.properties.className.includes("language-math"));
        if (isMath || isMathPre) {
          const aliases: FragmentNode[] = [];
          const takeTargets = (scope: FragmentNode) => {
            if (scope.targetAliasId) {
              aliases.push({ type: "element", tagName: "span", properties: { id: scope.targetAliasId }, children: [] });
              delete scope.targetAliasId;
            }
            for (const key of ["id", "name"] as const) {
              const value = scope.properties?.[key];
              if (typeof value !== "string") continue;
              aliases.push({ type: "element", tagName: "span", properties: { id: value }, children: [] });
              delete scope.properties![key];
            }
            scope.children?.forEach(takeTargets);
          };
          takeTargets(node);
          if (aliases.length) return {
            type: "element", tagName: isMathPre ? "div" : "span",
            properties: {}, children: [...aliases, node],
          };
        } else {
          protectMathTargets(node);
        }
        return node;
      });
    };
    protectMathTargets(tree);
  };
}

// Every overridden renderer shares this inert target contract. Put IDs on its
// existing DOM root, not sibling wrappers (which are invalid in tables/lists).
// Headings retain their trusted ID and carry an empty inline authored-ID alias.
function withSanitizedTargets(components: Components): Components {
  return Object.fromEntries(Object.entries(components).map(([tag, Renderer]) => [
    tag,
    (props: GetCoreProps) => {
      const properties = props.node?.properties;
      const id = typeof properties?.id === "string" ? properties.id : undefined;
      const name = typeof properties?.name === "string" ? properties.name : undefined;
      const aliasId = props.node?.targetAliasId;
      const rendered = (Renderer as (props: GetCoreProps) => ReactElement | null)(props);
      if (!id && !name && !aliasId) return rendered;
      if (!rendered) return <><span id={id} />{aliasId && <span id={aliasId} />}</>;
      if (/^h[1-6]$/.test(tag)) {
        return cloneElement(rendered, {}, <><span id={id} />{props.children}</>);
      }
      if (tag === "code" && aliasId) {
        if (rendered.type === CodeBlock) return cloneElement(rendered, { id, targetAliasId: aliasId });
        return cloneElement(rendered, { id }, <><span id={aliasId} />{props.children}</>);
      }
      return cloneElement(rendered, { ...(id ? { id } : {}), ...(name ? { name } : {}) });
    },
  ])) as Components;
}

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
  node?: FragmentNode;
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

const extractMarkdownHeadings = (md: string): SourceHeading[] => {
  const headings: SourceHeading[] = [];
  const slugHeading = createHeadingSlugger();
  let inFence = false;
  let fenceMarker = "";

  md.split(/\r?\n/).forEach((line, index) => {
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
      sourceLine: index + 1,
      sourceColumn: line.indexOf("#") + 1,
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
  const headingOrigins: HeadingOrigins = new Map();
  // Bodies starting at H1 are nested under the indexed reader title. Keep
  // source font sizes and slugs, but shift their semantic hierarchy by one.
  const headingOffset = markdownHeadings.some((heading) => heading.level === 1)
    ? 1
    : 0;
  const tocHeadings = useMemo(() => {
    const articleHeadings = markdownHeadings.map((heading) => ({
      ...heading,
      level: Math.min(6, heading.level + headingOffset),
    }));
    const sectionHeadings = articleHeadings.filter(
      (heading) => heading.level >= 2 && heading.level <= 4
    );

    return sectionHeadings.length > 0
      ? sectionHeadings
      : articleHeadings.filter((heading) => heading.level <= 4);
  }, [markdownHeadings, headingOffset]);

  const renderHeading = (
    props: GetCoreProps,
    as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
    size: string
  ) => {
    return (
      <Heading
        id={props.node?.renderedHeadingId}
        tabIndex={-1}
        scrollMarginTop="2rem"
        my={4}
        as={`h${Math.max(2, Math.min(6, Number(as[1]) + headingOffset))}` as typeof as}
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
            [captureMarkdownHeadingOrigins, { headings: markdownHeadings, origins: headingOrigins }],
            rehypeRaw,
            [rehypeSanitize, proposalHtmlSchema],
            [reconcileSanitizedFragments, { headings: markdownHeadings, origins: headingOrigins }],
            [
              rehypeKatex,
              {
                throwOnError: false,
                output: "htmlAndMathml",
                strict: false,
                trust: false,
              },
            ],
          ]}
          components={withSanitizedTargets({
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
              const isMultiLine = (children?.toString() ?? "").includes("\n");

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
              // Sanitized-away destinations must not become resolved upstream URLs.
              if (!props.href) {
                // A named/id-only anchor is a legitimate sanitized target, not
                // a link. Forward only these inert attributes; never resolve it.
                const name = typeof props.node?.properties.name === "string"
                  ? props.node.properties.name : undefined;
                if (props.id || name) {
                  return <a id={props.id} {...(name ? { name } : {})}>{props.children}</a>;
                }
                return <Text as="span">{props.children}</Text>;
              }
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
              if (!props.src) return null;
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
            thead: (props) => <Thead>{props.children}</Thead>,
            tbody: (props) => <Tbody>{props.children}</Tbody>,
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
          })}
        >
          {processedMd}
        </ReactMarkdown>
      </Box>
    </Box>
  );
};
