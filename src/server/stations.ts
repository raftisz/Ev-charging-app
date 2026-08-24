import "server-only";
import { prisma } from "@/lib/prisma";
import { ORIGIN, distanceKm, etaMinutes } from "@/lib/geo";
import { CONNECTOR_LABEL } from "@/lib/format";
import type {
  ChargerDTO,
  ConnectorType,
  StationDTO,
  StationDetailDTO,
} from "@/lib/types";

export type StationFilters = {
  q?: string;
  status?: string;
  connector?: string;
  minPower?: number;
  maxPrice?: number;
  availableOnly?: boolean;
  favoritesOnly?: boolean;
  sort?: "distance" | "price" | "rating" | "power" | "name";
};

const stationInclude = {
  chargers: { include: { connectors: true }, orderBy: { chargerCode: "asc" } },
} as const;

type StationRecord = Awaited<
  ReturnType<typeof prisma.station.findFirstOrThrow<{ include: typeof stationInclude }>>
>;

function toChargerDTO(charger: StationRecord["chargers"][number]): ChargerDTO {
  return {
    id: charger.id,
    chargerCode: charger.chargerCode,
    status: charger.status,
    powerKw: charger.powerKw,
    connectors: charger.connectors.map((c) => ({
      id: c.id,
      type: c.type,
      label: CONNECTOR_LABEL[c.type] ?? c.type,
      powerKw: c.powerKw,
    })),
  };
}

export function serializeStation(
  station: StationRecord,
  favoriteIds: Set<number> = new Set(),
): StationDetailDTO {
  const chargers = station.chargers.map(toChargerDTO);
  const availableCount = chargers.filter((c) => c.status === "AVAILABLE").length;
  const dist = distanceKm(ORIGIN, {
    lat: station.latitude,
    lng: station.longitude,
  });
  const connectorTypes = [
    ...new Set(chargers.flatMap((c) => c.connectors.map((x) => x.type))),
  ] as ConnectorType[];

  return {
    id: station.id,
    name: station.name,
    address: station.address,
    city: station.city,
    latitude: station.latitude,
    longitude: station.longitude,
    operator: station.operator,
    status: station.status,
    openingHours: station.openingHours,
    pricePerKwh: station.pricePerKwh,
    rating: station.rating,
    reviewCount: station.reviewCount,
    amenities: station.amenities
      ? station.amenities.split(",").map((a) => a.trim()).filter(Boolean)
      : [],
    chargerCount: chargers.length,
    availableCount,
    maxPowerKw: chargers.reduce((max, c) => Math.max(max, c.powerKw), 0),
    connectorTypes,
    distanceKm: Math.round(dist * 10) / 10,
    etaMin: etaMinutes(dist),
    isFavorite: favoriteIds.has(station.id),
    isOpen: station.status === "AVAILABLE" || station.status === "BUSY",
    chargers,
  };
}

async function favoriteIdsFor(userId?: number) {
  if (!userId) return new Set<number>();
  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { stationId: true },
  });
  return new Set(rows.map((r) => r.stationId));
}

export async function listStations(
  filters: StationFilters = {},
  userId?: number,
): Promise<StationDTO[]> {
  const favorites = await favoriteIdsFor(userId);

  const stations = await prisma.station.findMany({
    where: filters.q
      ? {
          OR: [
            { name: { contains: filters.q } },
            { address: { contains: filters.q } },
            { operator: { contains: filters.q } },
          ],
        }
      : undefined,
    include: stationInclude,
    orderBy: { name: "asc" },
  });

  let result = stations.map((s) => serializeStation(s, favorites));

  if (filters.status) result = result.filter((s) => s.status === filters.status);
  if (filters.connector) {
    result = result.filter((s) => s.connectorTypes.includes(filters.connector as ConnectorType));
  }
  if (filters.minPower) result = result.filter((s) => s.maxPowerKw >= filters.minPower!);
  if (filters.maxPrice) result = result.filter((s) => s.pricePerKwh <= filters.maxPrice!);
  if (filters.availableOnly) result = result.filter((s) => s.availableCount > 0);
  if (filters.favoritesOnly) result = result.filter((s) => s.isFavorite);

  const sorters: Record<string, (a: StationDTO, b: StationDTO) => number> = {
    distance: (a, b) => a.distanceKm - b.distanceKm,
    price: (a, b) => a.pricePerKwh - b.pricePerKwh,
    rating: (a, b) => b.rating - a.rating,
    power: (a, b) => b.maxPowerKw - a.maxPowerKw,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  result.sort(sorters[filters.sort ?? "distance"]);

  return result;
}

export async function getStation(id: number, userId?: number) {
  const station = await prisma.station.findUnique({
    where: { id },
    include: stationInclude,
  });
  if (!station) return null;
  return serializeStation(station, await favoriteIdsFor(userId));
}

/** Distance + price + live availability, the ranking used on the dashboard. */
export async function recommendedStations(userId?: number, take = 3) {
  const stations = await listStations({ availableOnly: true }, userId);
  const scored = stations.map((s) => ({
    station: s,
    score:
      s.distanceKm * 1.6 +
      s.pricePerKwh * 0.9 -
      s.maxPowerKw / 40 -
      s.rating * 1.2 -
      (s.isFavorite ? 3 : 0),
  }));
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, take).map((x) => x.station);
}
