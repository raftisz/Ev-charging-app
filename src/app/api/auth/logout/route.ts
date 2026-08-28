import { NextResponse } from "next/server";
import { endSession } from "@/server/auth";
import { handler } from "@/server/http";

export const POST = handler(async () => {
  await endSession();
  return NextResponse.json({ ok: true });
});
