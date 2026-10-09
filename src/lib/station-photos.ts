/**
 * Photos for the seeded stations, keyed by station name. The files live in
 * `public/stations/` and are credited in `docs/credits.md`.
 *
 * The database stores only `Station.imageUrl`; the seed and the
 * `add_station_image_url` migration both fill it from this list, so keep the
 * two in step (tests/station-photos.test.ts checks they match). The alt text
 * describes what each photo shows, since the photos are stand-ins rather than
 * pictures of the stations themselves.
 */
export const STATION_PHOTOS: Record<string, { src: string; alt: string }> = {
  "Sukhumvit Supercharge Hub": {
    src: "/stations/sukhumvit-supercharge-hub.webp",
    alt: "Row of EV chargers beside green-marked bays under large shade trees",
  },
  "Siam Green Station": {
    src: "/stations/siam-green-station.webp",
    alt: "Indoor car park level with blue-painted EV charging bays and wall chargers",
  },
  "Riverside EV Point": {
    src: "/stations/riverside-ev-point.webp",
    alt: "Single fast charger at a parking bay beside a park footpath",
  },
  "Central Park Charging Bay": {
    src: "/stations/central-park-charging-bay.webp",
    alt: "EV charging posts in a car park lined with palms and tropical plants",
  },
  "Northline Fast Charge": {
    src: "/stations/northline-fast-charge.webp",
    alt: "Two chargers inside a green glass shelter with a painted wooden canopy",
  },
  "Sathorn Business Hub": {
    src: "/stations/sathorn-business-hub.webp",
    alt: "Basement parking bay with a green plug marking and a wall-mounted charger",
  },
  "Chatuchak Charge & Go": {
    src: "/stations/chatuchak-charge-and-go.webp",
    alt: "Multi-connector rapid charger against a wooden fence with EV parking signs",
  },
  "Rama IX Power Station": {
    src: "/stations/rama-ix-power-station.webp",
    alt: "Several DC chargers behind green-painted EV bays on a sunny day",
  },
  "Ekkamai Urban Charger": {
    src: "/stations/ekkamai-urban-charger.webp",
    alt: "Charging pillar beside a paved EV bay in a residential neighbourhood",
  },
  "Bang Na Highway Stop": {
    src: "/stations/bang-na-highway-stop.webp",
    alt: "DC charger at a highway rest area with marked EV bays and cones",
  },
  "Ratchada Night Charge": {
    src: "/stations/ratchada-night-charge.webp",
    alt: "Charging cable plugged into a car at dusk with city lights behind",
  },
  "Ari Neighborhood Station": {
    src: "/stations/ari-neighborhood-station.webp",
    alt: "Two rapid chargers in a small neighbourhood car park with hedges",
  },
  "Thonglor Premium Charge": {
    src: "/stations/thonglor-premium-charge.webp",
    alt: "Teal EV bay and charging post in front of an elegant white arcade",
  },
  "Phrom Phong Skyline Hub": {
    src: "/stations/phrom-phong-skyline-hub.webp",
    alt: "Wall-mounted chargers along a clean indoor parking deck",
  },
  "Ladprao Community Charger": {
    src: "/stations/ladprao-community-charger.webp",
    alt: "Charging posts along EV bays next to a village green",
  },
  "Silom District Point": {
    src: "/stations/silom-district-point.webp",
    alt: "Car charging at a street-side charger on a rainy city night",
  },
  "Asoke Intersection Hub": {
    src: "/stations/asoke-intersection-hub.webp",
    alt: "Three EV bays with green plug markings and chargers in an indoor car park",
  },
  "Bangna Trad Express": {
    src: "/stations/bangna-trad-express.webp",
    alt: "Roadside charger by a grass verge where the road curves away",
  },
  "Onnut Local Charger": {
    src: "/stations/onnut-local-charger.webp",
    alt: "Empty EV-only bays with three charging posts beside trees",
  },
  "Suvarnabhumi Airport Hub": {
    src: "/stations/suvarnabhumi-airport-hub.webp",
    alt: "Airport parking garage with marked EV bays and wall chargers",
  },
};

/** Alt text for a station's photo; a generic description for unknown files. */
export function stationPhotoAlt(station: { name: string; imageUrl: string | null }) {
  const known = STATION_PHOTOS[station.name];
  if (known && known.src === station.imageUrl) return known.alt;
  return `Charging bays at ${station.name}`;
}
