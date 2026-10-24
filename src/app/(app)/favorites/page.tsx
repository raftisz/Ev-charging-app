"use client";

import { Page } from "@/components/layout/Page";
import { api } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { StationCard } from "@/components/stations/StationCard";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { StationDTO } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";

export default function FavoritesPage() {
  const toast = useToast();
  const { m } = useI18n();
  const { data, loading, error, reload } = useAsync(() => api.favorites());
  const stations = data?.stations ?? [];

  async function remove(station: StationDTO) {
    try {
      await api.removeFavorite(station.id);
      toast.push(m.stations.removed);
      void reload(true);
    } catch {
      toast.push(m.stations.favoriteFailed, "error");
    }
  }

  return (
    <Page title={m.stations.favoritesTitle} subtitle={m.stations.savedCount(stations.length)}>
      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={3} /> : null}

      {data && stations.length === 0 ? (
        <EmptyState
          icon="♥"
          title={m.stations.noFavoritesTitle}
          description={m.stations.noFavoritesBody}
          action={{ label: m.stations.browse, href: "/stations" }}
        />
      ) : null}

      {stations.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {stations.map((station) => (
            <StationCard key={station.id} station={station} onToggleFavorite={remove} />
          ))}
        </div>
      ) : null}
    </Page>
  );
}
