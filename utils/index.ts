import { Metadata } from "next";
import { EipMetadataJson } from "@/types";

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
  const regex = /(--|---)\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)/;
  const match = text.match(regex);

  if (match) {
    return {
      metadata: match[2],
      markdown: match[3],
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
        jsonObject[key.trim()] = value.split(",").map((v) => parseInt(v));
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

export const EIPStatus: {
  [status: string]: {
    bg: string;
    prefix: string;
    description: string;
  };
} = {
  Draft: {
    bg: "#D69E2E", // yellow.500 (using # values so it works for the metaimg generation)
    prefix: "⚠️",
    description:
      "This EIP is not yet recommended for general use or implementation, as it is subject to normative (breaking) changes.",
  },
  Review: {
    bg: "#D69E2E", // yellow.500
    prefix: "⚠️",
    description:
      "This EIP is not yet recommended for general use or implementation, as it is subject to normative (breaking) changes.",
  },
  "Last Call": {
    bg: "#38A169", // green.500
    prefix: "📢",
    description:
      "This EIP is in the last call for review stage. The authors wish to finalize the EIP and ask you to provide feedback.",
  },
  Final: {
    bg: "#38A169", // green.500
    prefix: "🎉",
    description: "This EIP has been accepted and implemented.",
  },
  Stagnant: {
    bg: "#E53E3E", // red.500
    prefix: "🚧",
    description:
      "This EIP had no activity for at least 6 months. This EIP should not be used.",
  },
  Withdrawn: {
    bg: "#E53E3E", // red.500
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
