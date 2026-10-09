"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import Link from "next/link";
import { kw, thb } from "@/lib/format";
import type { StationDTO } from "@/lib/types";
import { ORIGIN } from "@/lib/geo";

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "#10B981",
  BUSY: "#F59E0B",
  OFFLINE: "#EF4444",
  MAINTENANCE: "#94A3B8",
};

/**
 * Leaflet on OpenStreetMap tiles. Imported dynamically by the pages that use
 * it because Leaflet touches `window` at module scope.
 */
export default function StationMap({
  stations,
  selectedId,
  onSelect,
  className = "h-full w-full",
}: {
  stations: StationDTO[];
  selectedId?: number | null;
  onSelect?: (station: StationDTO) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<number, Marker>>(new Map());
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  const signature = useMemo(
    () => stations.map((s) => `${s.id}:${s.status}:${s.availableCount}`).join("|"),
    [stations],
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [ORIGIN.lat, ORIGIN.lng],
          zoom: 12,
          zoomControl: true,
          scrollWheelZoom: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);

        L.circleMarker([ORIGIN.lat, ORIGIN.lng], {
          radius: 7,
          color: "#fff",
          weight: 3,
          fillColor: "#2563EB",
          fillOpacity: 1,
        })
          .bindTooltip("You are here", { direction: "top" })
          .addTo(mapRef.current);
      }

      const map = mapRef.current;
      for (const marker of markersRef.current.values()) marker.remove();
      markersRef.current.clear();

      for (const station of stations) {
        const color = STATUS_COLOR[station.status] ?? "#94A3B8";
        const icon = L.divIcon({
          className: "",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          html: `<div style="width:34px;height:34px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 8px 18px -8px rgba(30,58,138,.7);display:flex;align-items:center;justify-content:center;color:#fff;font:700 12px Poppins,sans-serif">${station.availableCount}</div>`,
        });

        const marker = L.marker([station.latitude, station.longitude], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="min-width:190px">
               <div style="font:600 14px Poppins,sans-serif;color:#0F172A">${station.name}</div>
               <div style="font-size:12px;color:#94A3B8;margin-top:3px">${station.address}</div>
               <div style="font-size:12.5px;color:#64748B;margin-top:7px">
                 ${station.availableCount} of ${station.chargerCount} free · ${kw(station.maxPowerKw)} · ${thb(station.pricePerKwh)}/kWh
               </div>
               <a href="/stations/${station.id}" style="display:inline-block;margin-top:9px;font:600 12.5px Inter;color:#2563EB">View station →</a>
             </div>`,
          );

        marker.on("click", () => onSelectRef.current?.(station));
        markersRef.current.set(station.id, marker);
      }

      if (stations.length > 0 && !selectedId) {
        const bounds = L.latLngBounds(
          stations.map((s) => [s.latitude, s.longitude] as [number, number]),
        );
        map.fitBounds(bounds.pad(0.18), { animate: false });
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const station = stations.find((s) => s.id === selectedId);
    const marker = markersRef.current.get(selectedId);
    if (station && marker) {
      mapRef.current.setView([station.latitude, station.longitude], 15, { animate: true });
      marker.openPopup();
    }
  }, [selectedId, stations]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="h-full w-full rounded-[16px]" />
      <MapLegend />
    </div>
  );
}

function MapLegend() {
  const items = [
    ["Available", STATUS_COLOR.AVAILABLE],
    ["Busy", STATUS_COLOR.BUSY],
    ["Offline", STATUS_COLOR.OFFLINE],
    ["Maintenance", STATUS_COLOR.MAINTENANCE],
  ] as const;

  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-[500] rounded-[16px] bg-white/95 px-3.5 py-3 shadow-[var(--shadow-card)] backdrop-blur">
      <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.06em] text-faint uppercase">
        Station status
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {items.map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StationMapLink({ station }: { station: StationDTO }) {
  return (
    <Link
      href={`https://www.openstreetmap.org/?mlat=${station.latitude}&mlon=${station.longitude}#map=17/${station.latitude}/${station.longitude}`}
      target="_blank"
      rel="noreferrer"
      className="text-[13px] font-semibold text-brand"
    >
      Open in maps →
    </Link>
  );
}
