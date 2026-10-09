import Image from "next/image";
import clsx from "clsx";
import type { ReactNode } from "react";
import { stationPhotoAlt } from "@/lib/station-photos";

/**
 * A station's photo, filling its (positioned, sized) parent. Without a photo
 * it falls back to the original gradient, tinted with the station's
 * imageHue so neighbouring cards still look different.
 *
 * `scrim` darkens the bottom of the photo so white text laid over it stays
 * readable whatever the picture is.
 */
export function StationPhoto({
  station,
  sizes,
  priority = false,
  scrim = false,
  className,
  children,
}: {
  station: { name: string; imageUrl: string | null; imageHue: number };
  /** The rendered width, for next/image to pick a file size. */
  sizes: string;
  priority?: boolean;
  scrim?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const hue = station.imageHue;
  return (
    <div
      className={clsx("relative overflow-hidden", className)}
      data-testid="station-photo"
      data-photo={station.imageUrl ? "image" : "fallback"}
      data-hue={hue}
      style={
        station.imageUrl
          ? { background: `hsl(${hue} 30% 22%)` }
          : {
              background: `linear-gradient(140deg, hsl(${hue} 64% 33%), hsl(${hue} 83% 53%) 65%, hsl(160 84% 39%))`,
            }
      }
    >
      {station.imageUrl ? (
        <Image
          src={station.imageUrl}
          alt={stationPhotoAlt(station)}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <>
          <svg
            viewBox="0 0 600 200"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full opacity-25"
            aria-hidden
          >
            <rect x="60" y="70" width="56" height="130" rx="12" fill="#fff" opacity=".5" />
            <rect x="190" y="40" width="56" height="160" rx="12" fill="#fff" opacity=".35" />
            <rect x="320" y="90" width="56" height="110" rx="12" fill="#fff" opacity=".45" />
            <rect x="450" y="58" width="56" height="142" rx="12" fill="#fff" opacity=".3" />
          </svg>
          <span className="sr-only">No photo of {station.name} yet</span>
        </>
      )}
      {scrim ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(15,23,42,0.78),rgba(15,23,42,0.25)_55%,rgba(15,23,42,0.1))]"
        />
      ) : null}
      {children}
    </div>
  );
}
