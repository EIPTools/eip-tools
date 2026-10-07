import { extractMarkdownHeadings } from "./markdownHeadings";

export interface SearchProposal {
  proposalId: string;
  label: string;
  title: string;
  type: "EIP" | "ERC" | "RIP" | "CAIP";
  status: string;
  url: string;
  sourceUrl: string;
  prState?: string;
}

export interface ProposalSearchDocument extends SearchProposal {
  id: string;
  section: string;
  body: string;
}

// Keep code and mathematical notation intact. Markdown syntax is harmless to
// tokenization; deleting underscores or angle brackets would corrupt identifiers.
export function proposalSearchDocuments(proposal: SearchProposal, markdown: string): ProposalSearchDocument[] {
  const body = markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, "");
  const lines = body.split(/\r?\n/);
  const headings = extractMarkdownHeadings(body);
  const sections = [
    { id: "", text: "Overview", start: 0, end: headings[0] ? headings[0].sourceLine - 1 : lines.length },
    ...headings.map((heading, i) => ({
      id: heading.id, text: heading.text, start: heading.sourceLine - 1,
      end: headings[i + 1] ? headings[i + 1].sourceLine - 1 : lines.length,
    })),
  ];
  const documents: ProposalSearchDocument[] = [];
  for (const section of sections) {
    const text = lines.slice(section.start, section.end).join("\n").trim();
    if (!text) continue;
    // Bound exceptionally large sections without dropping any content. All
    // parts link to the same heading. Character chunks stay below token limits.
    const chunks = text.match(/[\s\S]{1,24000}/g) ?? [];
    chunks.forEach((chunk, i) => documents.push({
      ...proposal,
      id: `${proposal.proposalId}__${section.id || "intro"}__${i}`,
      section: section.text,
      body: chunk,
      url: section.id ? `${proposal.url}#${section.id}` : proposal.url,
    }));
  }
  return documents;
}

export const proposalSearchSettings = {
  searchableAttributes: ["label", "title", "section", "body"],
  filterableAttributes: ["type", "status", "prState", "proposalId"],
  displayedAttributes: ["id", "proposalId", "label", "title", "type", "status", "prState", "section", "body", "url", "sourceUrl"],
  distinctAttribute: "proposalId",
  typoTolerance: { disableOnAttributes: ["label"], disableOnNumbers: true },
};
