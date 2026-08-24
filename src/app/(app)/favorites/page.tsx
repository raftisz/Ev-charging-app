"use client";

import { Page } from "@/components/layout/Page";
import { api } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { StationCard } from "@/components/stations/StationCard";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { StationDTO } from "@/lib/types";

export default function FavoritesPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.favorites());
  const stations = data?.stations ?? [];

  async function remove(station: StationDTO) {
    try {
      await api.removeFavorite(station.id);
      toast.push("Removed from favourites");
      void reload(true);
    } catch {
      toast.push("Could not update favourites", "error");
    }
  }

  return (
    <Page title="Favourite stations" subtitle={`${stations.length} saved`}>
      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={3} /> : null}

      {data && stations.length === 0 ? (
        <EmptyState
          icon="♥"
          title="No favourites yet"
          description="Tap the heart on any station to keep it at the top of your list."
          action={{ label: "Browse stations", href: "/stations" }}
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
