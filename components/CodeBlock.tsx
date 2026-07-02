import React, { useState } from "react";
import { Box, IconButton } from "@chakra-ui/react";
import { CopyIcon, CheckCircleIcon } from "@chakra-ui/icons";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";

type CodeBlockProps = {
  children: string;
  language: string;
};

const syntaxTheme = {
  'code[class*="language-"]': {
    color: "#D4D4D8",
    background: "transparent",
    fontFamily:
      "var(--font-jetbrains-mono), 'JetBrains Mono', Consolas, monospace",
    textShadow: "none",
    whiteSpace: "pre",
  },
  'pre[class*="language-"]': {
    color: "#D4D4D8",
    background: "transparent",
    fontFamily:
      "var(--font-jetbrains-mono), 'JetBrains Mono', Consolas, monospace",
    textShadow: "none",
  },
  comment: { color: "#71717A" },
  prolog: { color: "#71717A" },
  doctype: { color: "#71717A" },
  cdata: { color: "#71717A" },
  punctuation: { color: "#A1A1AA" },
  property: { color: "#93C5FD" },
  tag: { color: "#F87171" },
  boolean: { color: "#F59E0B" },
  number: { color: "#F59E0B" },
  constant: { color: "#F59E0B" },
  symbol: { color: "#F59E0B" },
  selector: { color: "#86EFAC" },
  "attr-name": { color: "#86EFAC" },
  string: { color: "#86EFAC" },
  char: { color: "#86EFAC" },
  builtin: { color: "#86EFAC" },
  inserted: { color: "#86EFAC" },
  operator: { color: "#67E8F9" },
  entity: { color: "#67E8F9" },
  url: { color: "#67E8F9" },
  variable: { color: "#E4E4E7" },
  atrule: { color: "#C084FC" },
  "attr-value": { color: "#C084FC" },
  function: { color: "#C084FC" },
  "class-name": { color: "#C084FC" },
  keyword: { color: "#F0ABFC" },
  regex: { color: "#F59E0B" },
  important: { color: "#F59E0B", fontWeight: "600" },
  deleted: { color: "#F87171" },
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ children, language }) => {
  const [copied, setCopied] = useState(false);
  const code = children.replace(/^\n+/, "").replace(/\n+$/, "");

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  return (
    <Box
      position="relative"
      overflow="hidden"
      rounded="lg"
      border="1px solid"
      borderColor="border.default"
      bg="bg.subtle"
      my={6}
      sx={{
        code: {
          bg: "transparent",
          p: 0,
          borderRadius: 0,
        },
        span: {
          bg: "transparent !important",
        },
        "pre::-webkit-scrollbar": {
          h: "6px",
        },
        "pre::-webkit-scrollbar-track": {
          bg: "transparent",
        },
        "pre::-webkit-scrollbar-thumb": {
          bg: "border.strong",
          rounded: "full",
        },
        "pre::-webkit-scrollbar-thumb:hover": {
          bg: "text.tertiary",
        },
      }}
    >
      <CopyToClipboard text={code} onCopy={handleCopy}>
        <IconButton
          size="sm"
          position="absolute"
          top={3}
          right={3}
          zIndex="1"
          variant="ghost"
          color={copied ? "success.text" : "text.secondary"}
          bg="bg.base"
          border="1px solid"
          borderColor="border.default"
          _hover={{
            color: copied ? "success.text" : "text.primary",
            bg: "bg.emphasis",
          }}
          aria-label={copied ? "Copied" : "Copy code"}
          icon={copied ? <CheckCircleIcon /> : <CopyIcon />}
        />
      </CopyToClipboard>
      <SyntaxHighlighter
        language={language}
        style={syntaxTheme}
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "1rem 3.75rem 1rem 1rem",
          fontSize: "13px",
          lineHeight: "1.7",
          overflowX: "auto",
        }}
        codeTagProps={{
          style: {
            fontFamily:
              "var(--font-jetbrains-mono), 'JetBrains Mono', Consolas, monospace",
            background: "transparent",
            padding: 0,
            borderRadius: 0,
          },
        }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </Box>
  );
};
