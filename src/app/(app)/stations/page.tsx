"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { StationCard } from "@/components/stations/StationCard";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { CloseIcon, SearchIcon } from "@/components/ui/Icons";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { StationDTO } from "@/lib/types";

const StationMap = dynamic(() => import("@/components/stations/StationMap"), {
  ssr: false,
  loading: () => <div className="vg-skeleton h-full w-full rounded-[16px]" />,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "available", label: "Available now" },
  { key: "fast", label: "Fast 100 kW+" },
  { key: "value", label: "Best value" },
  { key: "favorites", label: "Favourites" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function StationsPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState("distance");
  const [showMap, setShowMap] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const params = useMemo(
    () => ({
      q: query.trim() || undefined,
      sort,
      available: filter === "available",
      favorites: filter === "favorites",
      minPower: filter === "fast" ? 100 : undefined,
      maxPrice: filter === "value" ? 8 : undefined,
    }),
    [query, sort, filter],
  );

  const { data, loading, error, reload, setData } = useAsync(
    () => api.stations(params),
    [params.q, params.sort, params.available, params.favorites, params.minPower, params.maxPrice],
  );

  const stations = data?.stations ?? [];

  async function toggleFavorite(station: StationDTO) {
    const next = !station.isFavorite;
    setData({
      total: data?.total ?? 0,
      stations: stations.map((s) => (s.id === station.id ? { ...s, isFavorite: next } : s)),
    });
    try {
      if (next) await api.addFavorite(station.id);
      else await api.removeFavorite(station.id);
      toast.push(next ? "Saved to favourites" : "Removed from favourites");
      if (filter === "favorites") void reload(true);
    } catch {
      setData({
        total: data?.total ?? 0,
        stations: stations.map((s) =>
          s.id === station.id ? { ...s, isFavorite: !next } : s,
        ),
      });
      toast.push("Could not update favourites", "error");
    }
  }

  const summary =
    query || filter !== "all"
      ? `${stations.length} of ${data?.total ?? 0} stations match`
      : `${stations.length} stations in the Bangkok network`;

  return (
    <Page
      title="Stations & map"
      subtitle={summary}
      action={
        <Button
          size="sm"
          variant="secondary"
          className="lg:hidden"
          onClick={() => setShowMap((v) => !v)}
        >
          {showMap ? "List" : "Map"}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-faint">
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or address"
              aria-label="Search stations"
              className="vg-input vg-search"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-4 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-surface-alt text-faint hover:text-ink"
              >
                <CloseIcon size={11} />
              </button>
            ) : null}
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort stations"
            className="w-[150px] shrink-0 rounded-full"
          >
            <option value="distance">Nearest</option>
            <option value="price">Cheapest</option>
            <option value="power">Fastest</option>
            <option value="rating">Top rated</option>
            <option value="name">A to Z</option>
          </Select>
        </div>

        <div className="vg-scroll-x -mx-4 flex gap-2 px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={clsx(
                "shrink-0 rounded-full px-4 py-2.5 text-[12.5px] font-semibold transition-all",
                filter === f.key
                  ? "bg-brand text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]"
                  : "bg-white text-muted shadow-[0_4px_14px_-10px_rgba(30,58,138,0.5)] hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className={clsx("min-w-0", showMap && "hidden lg:block")}>
          {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
          {loading && !data ? <ListSkeleton count={5} /> : null}

          {data && stations.length === 0 ? (
            <EmptyState
              title="No stations match those filters"
              description="Try clearing the search box or switching back to All."
              action={{ label: "Reset filters", onClick: () => { setQuery(""); setFilter("all"); } }}
            />
          ) : null}

          {stations.length ? (
            <div className="space-y-3">
              {stations.map((station) => (
                <div
                  key={station.id}
                  onMouseEnter={() => setSelectedId(station.id)}
                  onFocus={() => setSelectedId(station.id)}
                >
                  <StationCard
                    station={station}
                    onToggleFavorite={toggleFavorite}
                    className={clsx(selectedId === station.id && "border-brand")}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className={clsx(
            "h-[calc(100dvh-260px)] min-h-[380px] overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-card)] lg:sticky lg:top-[100px] lg:h-[calc(100dvh-140px)]",
            !showMap && "hidden lg:block",
          )}
        >
          <StationMap
            stations={stations}
            selectedId={selectedId}
            onSelect={(s) => setSelectedId(s.id)}
          />
        </div>
      </div>
    </Page>
  );
}
