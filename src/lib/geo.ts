/** Reference point used for "distance from you" (central Bangkok). */
export const ORIGIN = { lat: 13.7563, lng: 100.5018 };

/** Flat-earth approximation, plenty accurate across one city. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const dLat = (b.lat - a.lat) * 110.57;
  const dLng = (b.lng - a.lng) * 107.55; // cos(13.75°) corrected
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function etaMinutes(km: number) {
  return Math.max(3, Math.round(km * 3.6));
}
