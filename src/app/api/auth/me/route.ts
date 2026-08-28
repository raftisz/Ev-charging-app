import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { handler } from "@/server/http";
import { serializeUser } from "@/server/users";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? serializeUser(user) : null });
});
