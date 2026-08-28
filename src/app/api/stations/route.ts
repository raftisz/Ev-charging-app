import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getSession } from "@/server/auth";
import { handler, requireAdmin } from "@/server/http";
import { stationCreateSchema } from "@/lib/validation";
import { listStations, serializeStation, type StationFilters } from "@/server/stations";

export const dynamic = "force-dynamic";

export const GET = handler(async (request: Request) => {
  const url = new URL(request.url);
  const p = url.searchParams;
  const session = await getSession();

  const filters: StationFilters = {
    q: p.get("q")?.trim() || undefined,
    status: p.get("status") || undefined,
    connector: p.get("connector") || undefined,
    minPower: p.get("minPower") ? Number(p.get("minPower")) : undefined,
    maxPrice: p.get("maxPrice") ? Number(p.get("maxPrice")) : undefined,
    availableOnly: p.get("available") === "true",
    favoritesOnly: p.get("favorites") === "true",
    sort: (p.get("sort") as StationFilters["sort"]) || "distance",
  };

  const stations = await listStations(filters, session?.userId);
  return NextResponse.json({ stations, total: stations.length });
});

export const POST = handler(async (request: Request) => {
  await requireAdmin();
  const body = stationCreateSchema.parse(await request.json());
  const station = await prisma.station.create({
    data: body,
    include: { chargers: { include: { connectors: true } } },
  });
  return NextResponse.json({ station: serializeStation(station) }, { status: 201 });
});
