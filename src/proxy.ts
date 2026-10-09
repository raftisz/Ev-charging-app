/**
 * Route guard that runs before every page request (the Next 16 `proxy`
 * convention, previously `middleware`). Verification is JWT-only so it stays
 * edge-safe: no Prisma, no bcrypt.
 */
import { NextResponse, type NextRequest } from "next/server";
import { readToken, SESSION_COOKIE } from "@/lib/auth-edge";

const PROTECTED = [
  "/dashboard",
  "/stations",
  "/map",
  "/charging",
  "/reservations",
  "/history",
  "/wallet",
  "/profile",
  "/settings",
  "/favorites",
  "/notifications",
  "/admin",
];

const AUTH_PAGES = ["/login", "/register"];

/** Clears a stale cookie; must never be redirected, or the loop reappears. */
const ALWAYS_ALLOW = ["/session-expired"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readToken(token) : null;

  if (ALWAYS_ALLOW.includes(pathname)) return NextResponse.next();

  const needsAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (needsAuth && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/admin") &&
    session &&
    session.role !== "ADMIN" &&
    session.role !== "OPERATOR"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)"],
};
