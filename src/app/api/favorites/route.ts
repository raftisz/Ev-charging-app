import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/http";
import { listStations } from "@/server/stations";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();
  const stations = await listStations({ favoritesOnly: true }, user.id);
  return NextResponse.json({ stations });
});
