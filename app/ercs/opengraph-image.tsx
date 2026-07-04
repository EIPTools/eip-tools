import {
  createProposalListOpenGraphImage,
  proposalListOgContentType,
  proposalListOgSize,
} from "@/utils/proposalListOgImage";

export const runtime = "edge";
export const alt = "All ERCs on EIP.tools";
export const size = proposalListOgSize;
export const contentType = proposalListOgContentType;

export default function Image() {
  return createProposalListOpenGraphImage("erc");
}
