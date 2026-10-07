import { NextResponse } from "next/server";
import { MATCH_START, MATCH_END, matchedTerms, searchSnippet } from "@/utils/searchSnippet";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2) return NextResponse.json({ hits: [] });
  if (query.length > 200) return NextResponse.json({ error: "Search is limited to 200 characters." }, { status: 400 });
  const host = process.env.MEILISEARCH_HOST;
  const key = process.env.MEILISEARCH_SEARCH_KEY;
  if (!host || !key) return NextResponse.json({ error: "Full-text search is not configured." }, { status: 503 });
  try {
    const response = await fetch(`${host.replace(/\/$/, "")}/indexes/proposal_sections/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, matchingStrategy: "all", limit: 10,
        attributesToRetrieve: ["label", "title", "section", "url", "type", "status", "body"],
        attributesToHighlight: ["body", "title", "section"],
        highlightPreTag: MATCH_START, highlightPostTag: MATCH_END,
      }),
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Upstream search failed");
    const data = await response.json();
    const hits = data.hits.filter((hit: any) => /^\/(eip|rip|caip)\/\d+(?:#[\w-]+)?$/.test(hit.url)).map((hit: any) => {
      const terms = Array.from(new Set(["body", "title", "section"].flatMap(attribute => matchedTerms(hit._formatted?.[attribute] || ""))));
      return ({
      label: hit.label, title: hit.title, section: hit.section, url: hit.url, type: hit.type, status: hit.status,
      excerpt: searchSnippet(String(hit.body || ""), [query, ...terms]), matches: terms,
    }); });
    return NextResponse.json({ hits }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Full-text search is unavailable. Try again." }, { status: 503 });
  }
}
