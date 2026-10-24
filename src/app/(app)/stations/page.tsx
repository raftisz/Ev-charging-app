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
import { useI18n } from "@/i18n/I18nProvider";

const StationMap = dynamic(() => import("@/components/stations/StationMap"), {
  ssr: false,
  loading: () => <div className="vg-skeleton h-full w-full rounded-[16px]" />,
});

const FILTERS = ["all", "available", "fast", "value", "favorites"] as const;
const SORTS = ["distance", "price", "power", "rating", "name"] as const;

type FilterKey = (typeof FILTERS)[number];

export default function StationsPage() {
  const toast = useToast();
  const { m } = useI18n();
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
      toast.push(next ? m.stations.saved : m.stations.removed);
      if (filter === "favorites") void reload(true);
    } catch {
      setData({
        total: data?.total ?? 0,
        stations: stations.map((s) =>
          s.id === station.id ? { ...s, isFavorite: !next } : s,
        ),
      });
      toast.push(m.stations.favoriteFailed, "error");
    }
  }

  const summary =
    query || filter !== "all"
      ? m.stations.summaryFiltered(stations.length, data?.total ?? 0)
      : m.stations.summaryAll(stations.length);

  return (
    <Page
      title={m.stations.title}
      subtitle={summary}
      action={
        <Button
          size="sm"
          variant="secondary"
          className="lg:hidden"
          onClick={() => setShowMap((v) => !v)}
        >
          {showMap ? m.stations.list : m.stations.map}
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
              placeholder={m.stations.searchPlaceholder}
              aria-label={m.stations.searchLabel}
              className="vg-input vg-search"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                aria-label={m.stations.clearSearch}
                className="absolute top-1/2 right-4 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-surface-alt text-faint hover:text-ink"
              >
                <CloseIcon size={11} />
              </button>
            ) : null}
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label={m.stations.sortLabel}
            className="w-[150px] shrink-0 rounded-full"
          >
            {SORTS.map((key) => (
              <option key={key} value={key}>
                {m.stations.sort[key]}
              </option>
            ))}
          </Select>
        </div>

        <div className="vg-scroll-x -mx-4 flex gap-2 px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          {FILTERS.map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={clsx(
                "shrink-0 rounded-full px-4 py-2.5 text-[12.5px] font-semibold transition-all",
                filter === key
                  ? "bg-brand text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]"
                  : "bg-white text-muted shadow-[0_4px_14px_-10px_rgba(30,58,138,0.5)] hover:text-ink",
              )}
            >
              {m.stations.filter[key]}
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
              title={m.stations.emptyTitle}
              description={m.stations.emptyBody}
              action={{ label: m.stations.resetFilters, onClick: () => { setQuery(""); setFilter("all"); } }}
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
