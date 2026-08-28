/**
 * The 20 Bangkok stations from `docs/design-reference/station-data.js`, kept
 * verbatim so the seeded database matches the design reference exactly.
 *
 * Tuple: [id, name, lat, lng, pricePerKwh, rating, hasFastCharge, isOpen,
 *         openingHours, amenities, chargers[[code, connector, kW, available]]]
 */
export type ConnectorName = "CCS2" | "Type 2" | "CHAdeMO";
export type ChargerSpec = [string, ConnectorName, number, boolean];

export type StationRow = [
  number,
  string,
  number,
  number,
  number,
  number,
  boolean,
  boolean,
  string,
  string,
  ChargerSpec[],
];

const A = {
  wrc: "Wi-Fi, Restroom, Cafe",
  wcs: "Wi-Fi, Convenience Store",
  rlv: "Restroom, Lounge, Vending Machine",
  wrcl: "Wi-Fi, Restroom, Cafe, Lounge",
};
const H24 = "24 Hours";
const H6 = "06:00 - 24:00";
const H7 = "07:00 - 22:00";

export const ORIGIN = { lat: 13.7563, lng: 100.5018 };

export const STATION_ROWS: StationRow[] = [
  [1, "Sukhumvit Supercharge Hub", 13.7401, 100.5588, 9.5, 4.9, true, true, H24, A.wrc,
    [["A1", "CCS2", 180, true], ["B2", "CCS2", 180, true], ["C3", "Type 2", 60, true], ["D4", "CHAdeMO", 60, false]]],
  [2, "Siam Green Station", 13.7462, 100.5341, 8.2, 4.6, true, true, H6, A.wcs,
    [["A1", "CCS2", 120, true], ["B2", "CCS2", 120, false], ["C3", "Type 2", 22, true], ["D4", "Type 2", 22, false], ["E5", "CHAdeMO", 60, false]]],
  [3, "Riverside EV Point", 13.7225, 100.514, 7.4, 4.1, false, true, H7, A.rlv,
    [["A1", "Type 2", 60, false], ["B2", "Type 2", 22, false], ["C3", "CCS2", 60, false]]],
  [4, "Central Park Charging Bay", 13.7438, 100.5392, 8.9, 4.5, true, true, H7, A.rlv,
    [["A1", "CCS2", 120, true], ["B2", "CCS2", 120, true], ["C3", "Type 2", 22, true], ["D4", "Type 2", 22, true]]],
  [5, "Northline Fast Charge", 13.814, 100.523, 10.1, 4.4, true, true, H24, A.wrcl,
    [["A1", "CCS2", 180, true], ["B2", "CCS2", 180, false], ["C3", "CHAdeMO", 60, true]]],
  [6, "Sathorn Business Hub", 13.7221, 100.529, 10.4, 4.4, true, true, H6, A.wrc,
    [["A1", "CCS2", 180, true], ["B2", "CCS2", 120, false], ["C3", "Type 2", 60, false], ["D4", "CHAdeMO", 60, false]]],
  [7, "Chatuchak Charge & Go", 13.7989, 100.5501, 6.9, 4.0, false, true, H24, A.wcs,
    [["A1", "Type 2", 60, true], ["B2", "Type 2", 22, true], ["C3", "CCS2", 60, false]]],
  [8, "Rama IX Power Station", 13.758, 100.5662, 9.1, 4.8, true, true, H24, A.wrcl,
    [["A1", "CCS2", 180, true], ["B2", "CCS2", 180, true], ["C3", "Type 2", 60, true], ["D4", "CHAdeMO", 60, true], ["E5", "Type 2", 22, true]]],
  [9, "Ekkamai Urban Charger", 13.7203, 100.5772, 6.5, 3.9, false, true, H7, A.rlv,
    [["A1", "Type 2", 22, true], ["B2", "Type 2", 22, false]]],
  [10, "Bang Na Highway Stop", 13.679, 100.576, 7.6, 4.2, true, true, H24, A.wcs,
    [["A1", "CCS2", 120, true], ["B2", "CCS2", 120, true], ["C3", "CHAdeMO", 60, false]]],
  [11, "Ratchada Night Charge", 13.769, 100.5741, 7.8, 4.3, true, true, H24, A.rlv,
    [["A1", "CCS2", 120, true], ["B2", "CCS2", 120, true], ["C3", "CHAdeMO", 60, true], ["D4", "Type 2", 22, false]]],
  [12, "Ari Neighborhood Station", 13.7793, 100.5441, 7.2, 4.2, false, true, H7, A.wrc,
    [["A1", "Type 2", 60, true], ["B2", "Type 2", 60, true], ["C3", "Type 2", 22, false]]],
  [13, "Thonglor Premium Charge", 13.7291, 100.5792, 11.2, 4.7, true, true, H24, A.wrcl,
    [["A1", "CCS2", 180, false], ["B2", "CCS2", 180, false], ["C3", "CCS2", 120, false], ["D4", "Type 2", 60, false]]],
  [14, "Phrom Phong Skyline Hub", 13.7302, 100.5692, 9.8, 4.6, true, true, H6, A.wrc,
    [["A1", "CCS2", 120, true], ["B2", "CCS2", 120, false], ["C3", "Type 2", 60, true], ["D4", "CHAdeMO", 60, false]]],
  [15, "Ladprao Community Charger", 13.816, 100.561, 6.8, 3.8, false, true, H7, A.wcs,
    [["A1", "Type 2", 22, true], ["B2", "Type 2", 22, true], ["C3", "Type 2", 60, false]]],
  [16, "Silom District Point", 13.7281, 100.5341, 8.0, 4.3, true, true, H6, A.wrc,
    [["A1", "CCS2", 60, true], ["B2", "Type 2", 60, false], ["C3", "Type 2", 22, false]]],
  [17, "Asoke Intersection Hub", 13.7371, 100.5602, 9.9, 4.7, true, true, H24, A.wrcl,
    [["A1", "CCS2", 180, true], ["B2", "CCS2", 180, true], ["C3", "CCS2", 120, false], ["D4", "CHAdeMO", 60, true]]],
  [18, "Bangna Trad Express", 13.682, 100.582, 7.1, 4.0, true, false, H6, A.rlv,
    [["A1", "CCS2", 120, false], ["B2", "Type 2", 60, false], ["C3", "Type 2", 22, false]]],
  [19, "Onnut Local Charger", 13.7058, 100.5802, 6.6, 3.9, false, true, H7, A.wcs,
    [["A1", "Type 2", 22, true], ["B2", "Type 2", 22, true]]],
  [20, "Suvarnabhumi Airport Hub", 13.684, 100.533, 11.5, 4.8, true, true, H24, A.wrcl,
    [["A1", "CCS2", 180, true], ["B2", "CCS2", 180, true], ["C3", "CCS2", 120, true], ["D4", "CHAdeMO", 60, false], ["E5", "Type 2", 22, true]]],
];
