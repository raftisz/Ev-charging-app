import { NextResponse } from "next/server";
import { handler, requireAdmin } from "@/server/http";
import { getOcppConsole } from "@/server/ocpp/console";

export const dynamic = "force-dynamic";

/** GET /api/admin/ocpp[?identity=VG-01-A1] — charge points and the latest OCPP frames (staff). */
export const GET = handler(async (request: Request) => {
  await requireAdmin();
  const identity = new URL(request.url).searchParams.get("identity");
  return NextResponse.json(await getOcppConsole(identity));
});
