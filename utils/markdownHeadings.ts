export interface SourceHeading {
  id: string;
  level: number;
  text: string;
  sourceLine: number;
  sourceColumn: number;
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

export const extractMarkdownHeadings = (md: string): SourceHeading[] => {
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

