import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validEIPsArray } from "@/data/validEIPs";
import { validRIPsArray } from "@/data/validRIPs";
import { validCAIPsArray } from "@/data/validCAIPs";

export function middleware(request: NextRequest) {
  // Get the pathname from the URL (e.g., /1234)
  const pathname = request.nextUrl.pathname;

  // Remove the leading slash and check if it's a number
  const id = pathname.slice(1);
  if (!/^\d+$/.test(id)) {
    return NextResponse.next();
  }

  const numId = parseInt(id);

  // Check which type of proposal it is and redirect accordingly
  if (validEIPsArray.includes(numId)) {
    return NextResponse.redirect(new URL(`/eip/${id}`, request.url));
  }

  if (validRIPsArray.includes(numId)) {
    return NextResponse.redirect(new URL(`/rip/${id}`, request.url));
  }

  if (validCAIPsArray.includes(numId)) {
    return NextResponse.redirect(new URL(`/caip/${id}`, request.url));
  }

  // If the number doesn't match any valid proposal, continue to next middleware/route
  return NextResponse.next();
}

// Configure the middleware to only run on specific paths
export const config = {
  matcher: "/:path*",
};
