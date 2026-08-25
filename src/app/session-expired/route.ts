import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";
import { handler } from "@/lib/http";

/**
 * Breaks the redirect loop that happens when a session token is still valid
 * but its account is gone — deleted or disabled by an admin, or wiped by a
 * reseed. The proxy only verifies the JWT, so it keeps sending such a request
 * on to the app, while the app cannot find the user and sends it back to
 * /login. Server Components cannot clear cookies, so the app redirects here:
 * a route handler that can, and does, before handing over to /login.
 */
export const dynamic = "force-dynamic";

export const GET = handler(async (request: Request) => {
  await endSession();
  const url = new URL("/login", request.url);
  url.searchParams.set("expired", "1");
  return NextResponse.redirect(url);
});
