import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validEIPs } from "@/data/validEIPs";
import { validRIPs } from "@/data/validRIPs";
import { validCAIPs } from "@/data/validCAIPs";
import { getProposalDetails } from "@/utils/proposals";

const proposalsByRoute = { eip: validEIPs, rip: validRIPs, caip: validCAIPs };

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const match = pathname.match(/^\/(eip|rip|caip)\/(?:(eip|erc|rip|caip)-)?(\d{1,12})(?:\.md)?$/i);
  let target: string | undefined;
  if (match) {
    const route = match[1].toLowerCase() as keyof typeof proposalsByRoute;
    const prefix = match[2]?.toLowerCase();
    const prefixRoute = prefix === "erc" ? "eip" : prefix;
    if ((!prefix || route === prefixRoute) && getProposalDetails(proposalsByRoute[route], match[3])) {
      target = `/${route}/${match[3].replace(/^0+(?=\d)/, "")}`;
    }
  } else if (/^\/\d{1,12}$/.test(pathname)) {
    // Preserve the existing EIP → RIP → CAIP precedence for bare shortcuts.
    const id = pathname.slice(1);
    for (const [route, proposals] of Object.entries(proposalsByRoute)) {
      if (getProposalDetails(proposals, id)) {
        target = `/${route}/${id.replace(/^0+(?=\d)/, "")}`;
        break;
      }
    }
  }
  if (target && target !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    // Leave query/hash untouched. Browsers inherit the original fragment when
    // it is absent from the HTTP Location (fragments aren't sent to servers).
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = { matcher: "/:path*" };
