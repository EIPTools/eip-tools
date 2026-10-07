import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { highlightParts } from "./searchHighlight";

export const MATCH_START = "\uE000";
export const MATCH_END = "\uE001";
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
interface MarkdownNode { type: string; value?: string; alt?: string; children?: MarkdownNode[] }

// Parse complete source before cropping. Render text only: no upstream HTML,
// active links, images, or partially cut Markdown enters the dropdown.
export function markdownSnippetText(markdown: string): string {
  function text(node: MarkdownNode): string {
    if (node.type === "html" || node.type === "definition" || node.type === "heading") return "";
    if (node.type === "image" || node.type === "imageReference") return node.alt || "";
    if (node.value !== undefined) return node.value;
    const inline = ["paragraph", "emphasis", "strong", "delete", "link", "linkReference", "tableCell"].includes(node.type);
    return (node.children || []).map(text).join(inline ? "" : " ");
  }
  return text(parser.parse(markdown) as MarkdownNode).replace(/\s+/g, " ").trim();
}

export function matchedTerms(formatted: string): string[] {
  return Array.from(formatted.matchAll(/\uE000([^\uE000\uE001]+)\uE001/g)).map(match => match[1]);
}

export function searchSnippet(markdown: string, terms: string[], maxLength = 320): string {
  const plain = markdownSnippetText(markdown);
  if (plain.length <= maxLength) return plain;
  // Prefer the full query over shorter engine tokens when it occurs in code.
  const preferred = terms.find(term => term && plain.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
  const parts = highlightParts(plain, preferred ? [preferred] : terms);
  let firstMatch = 0;
  for (const part of parts) { if (part.match) break; firstMatch += part.text.length; }
  if (!parts.some(part => part.match)) firstMatch = 0;
  // Leave context before the first match; keep a whole identifier if possible.
  let start = Math.max(0, Math.min(firstMatch - 40, plain.length - maxLength));
  if (start > 0) { const boundary = plain.indexOf(" ", start); if (boundary < firstMatch && boundary >= 0) start = boundary + 1; }
  let end = Math.min(plain.length, start + maxLength);
  if (end < plain.length) { const boundary = plain.lastIndexOf(" ", end); if (boundary > start + maxLength / 2 && boundary > firstMatch) end = boundary; }
  return `${start ? "…" : ""}${plain.slice(start, end)}${end < plain.length ? "…" : ""}`;
}
