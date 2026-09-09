import { getProposalContent } from "@/utils/proposalContent.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { kind: string; number: string } }) {
  const { kind, number } = params;
  if (!["eip", "rip", "caip"].includes(kind) || !/^\d{1,12}$/.test(number)) {
    return Response.json({ error: "Invalid proposal" }, { status: 400 });
  }
  try {
    const content = await getProposalContent(kind as "eip" | "rip" | "caip", number);
    return Response.json(content, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=604800" },
    });
  } catch {
    return Response.json({ error: "This proposal is temporarily unavailable. Please try again." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
