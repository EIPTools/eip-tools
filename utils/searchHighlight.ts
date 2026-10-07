export interface HighlightPart { text: string; match: boolean }

export function highlightParts(text: string, terms: string[]): HighlightPart[] {
  const escaped = Array.from(new Set(terms.filter(Boolean)))
    .sort((a, b) => b.length - a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return [{ text, match: false }];
  const expression = new RegExp(escaped.join("|"), "giu");
  const parts: HighlightPart[] = [];
  let offset = 0;
  for (const match of Array.from(text.matchAll(expression))) {
    const start = match.index!;
    if (start > offset) parts.push({ text: text.slice(offset, start), match: false });
    parts.push({ text: match[0], match: true });
    offset = start + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), match: false });
  return parts;
}
