import { Metadata } from "next";
import authorsData from "@/data/authors/authors.json";
import customAuthors from "@/data/authors/custom-authors.json";
import {
  AuthorDirectoryEntry,
  EipMetadataJson,
  ProposalAuthorProfile,
} from "@/types";

const aliasMap = new Map<string, string>();
for (const entry of customAuthors.aliases) {
  for (const alias of entry.aliases) {
    aliasMap.set(alias.toLowerCase(), entry.primary);
  }
}

const authorDirectory = new Map<string, AuthorDirectoryEntry>();
for (const author of authorsData as AuthorDirectoryEntry[]) {
  const primary = aliasMap.get(author.handle.toLowerCase()) ?? author.handle;
  const key = primary.toLowerCase();
  const existing = authorDirectory.get(key);

  if (existing) {
    if (!existing.github && author.github) {
      existing.github = author.github;
    }
    if (!existing.twitter && author.twitter) {
      existing.twitter = author.twitter;
    }
    continue;
  }

  authorDirectory.set(key, {
    ...author,
    handle: primary,
    github: author.github || undefined,
    twitter: author.twitter || undefined,
  });
}

for (const [handle, twitterHandle] of Object.entries(customAuthors.twitterOverrides)) {
  const author = authorDirectory.get(handle.toLowerCase());
  if (author) {
    author.twitter = `https://x.com/${twitterHandle}`;
  }
}

const getGithubAvatarUrl = (githubUrl?: string) => {
  if (!githubUrl) return undefined;

  const handle = githubUrl.split("/").pop();
  return handle ? `https://github.com/${handle}.png?size=96` : undefined;
};

const getTwitterAvatarUrl = (twitterUrl?: string) => {
  if (!twitterUrl) return undefined;

  const handle = twitterUrl.split("/").pop();
  return handle ? `https://unavatar.io/x/${handle}` : undefined;
};

const parseAuthor = (author: string) => {
  const handleMatch = author.match(/\(@([^)]+)\)/);
  const handle = handleMatch?.[1];
  const displayName = author.replace(/\s*\(@[^)]+\)/, "").trim() || author.trim();

  return { displayName, handle };
};

export const extractEipNumber = (eipOrNo: string, prefix: string): string => {
  const match = eipOrNo.match(
    new RegExp(`^${prefix}-(\\d+)(?:\\.md)?$|^(\\d+)$`)
  );
  if (match) {
    return match[1] || match[2];
  } else {
    throw new Error("Invalid EIP format");
  }
};

export const extractMetadata = (text: string) => {
  const regex = /^[- ]*---[ -]*\r?\n([\s\S]*?)\r?\n[ -]*---[ -]*\r?\n([\s\S]*)/;
  const match = text.match(regex);

  if (match) {
    return {
      metadata: match[1],
      markdown: match[2],
    };
  } else {
    return {
      metadata: "",
      markdown: text,
    };
  }
};

export const convertMetadataToJson = (
  metadataText: string
): EipMetadataJson => {
  const lines = metadataText.split("\n");
  const jsonObject: any = {};

  lines.forEach((line) => {
    const [key, value] = line.split(/: (.+)/);
    if (key && value) {
      if (key.trim() === "eip") {
        jsonObject[key.trim()] = parseInt(value.trim());
      } else if (key.trim() === "requires") {
        jsonObject[key.trim()] = value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      } else if (key.trim() === "author") {
        jsonObject[key.trim()] = value
          .split(",")
          .map((author: string) => author.trim());
      } else {
        jsonObject[key.trim()] = value.trim();
      }
    }
  });

  return jsonObject as EipMetadataJson;
};

export const getProposalAuthorProfiles = (
  authors: string[] = []
): ProposalAuthorProfile[] => {
  return authors.map((raw) => {
    const { displayName, handle } = parseAuthor(raw);
    const author = handle
      ? authorDirectory.get(
          (aliasMap.get(handle.toLowerCase()) ?? handle).toLowerCase()
        )
      : undefined;

    const github = author?.github;
    const twitter = author?.twitter;

    return {
      raw,
      displayName,
      handle: author?.handle ?? handle,
      github,
      twitter,
      avatarUrl: getGithubAvatarUrl(github) ?? getTwitterAvatarUrl(twitter),
    };
  });
};

export const STATUS_COLORS = {
  Draft: "#D69E2E", // yellow.500 (using # values so it works for the metaimg generation)
  Review: "#F1C40F", // yellow.500
  "Last Call": "#38A169", // green.500
  Final: "#2ECC71", // green.500
  Stagnant: "#E53E3E", // red.500
  Withdrawn: "#95A5A6", // gray.500
};

export const EIPStatus: {
  [status: string]: {
    bg: string;
    prefix: string;
    description: string;
  };
} = {
  Draft: {
    bg: STATUS_COLORS.Draft,
    prefix: "⚠️",
    description:
      "This EIP is not yet recommended for general use or implementation, as it is subject to normative (breaking) changes.",
  },
  Review: {
    bg: STATUS_COLORS.Review,
    prefix: "⚠️",
    description:
      "This EIP is not yet recommended for general use or implementation, as it is subject to normative (breaking) changes.",
  },
  "Last Call": {
    bg: STATUS_COLORS["Last Call"],
    prefix: "📢",
    description:
      "This EIP is in the last call for review stage. The authors wish to finalize the EIP and ask you to provide feedback.",
  },
  Final: {
    bg: STATUS_COLORS.Final,
    prefix: "🎉",
    description: "This EIP has been accepted and implemented.",
  },
  Stagnant: {
    bg: STATUS_COLORS.Stagnant,
    prefix: "🚧",
    description:
      "This EIP had no activity for at least 6 months. This EIP should not be used.",
  },
  Withdrawn: {
    bg: STATUS_COLORS.Withdrawn,
    prefix: "🛑",
    description: "This EIP has been withdrawn, and should not be used.",
  },
};

export const getMetadata = (_metadata: {
  title: string;
  description: string;
  images: string;
}) => {
  const metadata: Metadata = {
    title: _metadata.title,
    description: _metadata.description,
    twitter: {
      card: "summary_large_image",
      title: _metadata.title,
      description: _metadata.description,
      images: _metadata.images,
    },
    openGraph: {
      type: "website",
      title: _metadata.title,
      description: _metadata.description,
      images: _metadata.images,
    },
    robots: "index, follow",
  };

  return metadata;
};

export const getBaseUrl = () => {
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || "eip.tools";

  if (vercelUrl.includes("localhost")) {
    return `http://${vercelUrl}`;
  } else {
    return `https://${vercelUrl}`;
  }
};

export const getReferencedByEIPs = (
  eipNo: string,
  graphData: any
): string[] => {
  const targetId = `eip-${eipNo}`;
  const referencedBy: string[] = [];

  // Find all links where current EIP is the target
  if (graphData.links) {
    for (const link of graphData.links) {
      if (link.target === targetId) {
        // Extract EIP number from source (remove "eip-" prefix)
        const sourceEipNo = link.source.replace("eip-", "");
        referencedBy.push(sourceEipNo);
      }
    }
  }

  return referencedBy.sort((a, b) => parseInt(a) - parseInt(b));
};
