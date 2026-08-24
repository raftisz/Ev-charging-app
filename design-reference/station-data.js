/* Volt Grid — single source of station truth for the prototype.
 *
 * Shape mirrors ev-charging-network `models.Station` / `models.Charger`.
 * Names are the 20 verbatim entries of seeder.STATION_NAMES.
 * Addresses follow the seeder pattern `f"{100 + i} Charging Road, Bangkok"`.
 * Coordinates, price_per_kwh, rating, opening_hours, amenities and charger
 * specs are fixed sample values drawn from the seeder's own ranges and
 * choice-lists (lat/lng 13.7563/100.5018 ±0.08, price 6.50–11.50,
 * rating 3.8–5.0, power {22,60,120,180}, connectors {CCS2, Type 2, CHAdeMO},
 * charger_code `{A..}{n}`) so the prototype stays stable across reloads.
 * The live app will replace this file with GET /api/stations.
 */
(function (root) {
  const A = {
    wrc:  'Wi-Fi, Restroom, Cafe',
    wcs:  'Wi-Fi, Convenience Store',
    rlv:  'Restroom, Lounge, Vending Machine',
    wrcl: 'Wi-Fi, Restroom, Cafe, Lounge'
  };
  const H24 = '24 Hours', H6 = '06:00 - 24:00', H7 = '07:00 - 22:00';

  // [id, name, lat, lng, price, rating, fast, open, hours, amenities, chargers[[code,connector,kw,available]]]
  const rows = [
    [1,'Sukhumvit Supercharge Hub',13.7401,100.5588,9.50,4.9,true,true,H24,A.wrc,
      [['A1','CCS2',180,true],['B2','CCS2',180,true],['C3','Type 2',60,true],['D4','CHAdeMO',60,false]]],
    [2,'Siam Green Station',13.7462,100.5341,8.20,4.6,true,true,H6,A.wcs,
      [['A1','CCS2',120,true],['B2','CCS2',120,false],['C3','Type 2',22,true],['D4','Type 2',22,false],['E5','CHAdeMO',60,false]]],
    [3,'Riverside EV Point',13.7225,100.5140,7.40,4.1,false,true,H7,A.rlv,
      [['A1','Type 2',60,false],['B2','Type 2',22,false],['C3','CCS2',60,false]]],
    [4,'Central Park Charging Bay',13.7438,100.5392,8.90,4.5,true,true,H7,A.rlv,
      [['A1','CCS2',120,true],['B2','CCS2',120,true],['C3','Type 2',22,true],['D4','Type 2',22,true]]],
    [5,'Northline Fast Charge',13.8140,100.5230,10.10,4.4,true,true,H24,A.wrcl,
      [['A1','CCS2',180,true],['B2','CCS2',180,false],['C3','CHAdeMO',60,true]]],
    [6,'Sathorn Business Hub',13.7221,100.5290,10.40,4.4,true,true,H6,A.wrc,
      [['A1','CCS2',180,true],['B2','CCS2',120,false],['C3','Type 2',60,false],['D4','CHAdeMO',60,false]]],
    [7,'Chatuchak Charge & Go',13.7989,100.5501,6.90,4.0,false,true,H24,A.wcs,
      [['A1','Type 2',60,true],['B2','Type 2',22,true],['C3','CCS2',60,false]]],
    [8,'Rama IX Power Station',13.7580,100.5662,9.10,4.8,true,true,H24,A.wrcl,
      [['A1','CCS2',180,true],['B2','CCS2',180,true],['C3','Type 2',60,true],['D4','CHAdeMO',60,true],['E5','Type 2',22,true]]],
    [9,'Ekkamai Urban Charger',13.7203,100.5772,6.50,3.9,false,true,H7,A.rlv,
      [['A1','Type 2',22,true],['B2','Type 2',22,false]]],
    [10,'Bang Na Highway Stop',13.6790,100.5760,7.60,4.2,true,true,H24,A.wcs,
      [['A1','CCS2',120,true],['B2','CCS2',120,true],['C3','CHAdeMO',60,false]]],
    [11,'Ratchada Night Charge',13.7690,100.5741,7.80,4.3,true,true,H24,A.rlv,
      [['A1','CCS2',120,true],['B2','CCS2',120,true],['C3','CHAdeMO',60,true],['D4','Type 2',22,false]]],
    [12,'Ari Neighborhood Station',13.7793,100.5441,7.20,4.2,false,true,H7,A.wrc,
      [['A1','Type 2',60,true],['B2','Type 2',60,true],['C3','Type 2',22,false]]],
    [13,'Thonglor Premium Charge',13.7291,100.5792,11.20,4.7,true,true,H24,A.wrcl,
      [['A1','CCS2',180,false],['B2','CCS2',180,false],['C3','CCS2',120,false],['D4','Type 2',60,false]]],
    [14,'Phrom Phong Skyline Hub',13.7302,100.5692,9.80,4.6,true,true,H6,A.wrc,
      [['A1','CCS2',120,true],['B2','CCS2',120,false],['C3','Type 2',60,true],['D4','CHAdeMO',60,false]]],
    [15,'Ladprao Community Charger',13.8160,100.5610,6.80,3.8,false,true,H7,A.wcs,
      [['A1','Type 2',22,true],['B2','Type 2',22,true],['C3','Type 2',60,false]]],
    [16,'Silom District Point',13.7281,100.5341,8.00,4.3,true,true,H6,A.wrc,
      [['A1','CCS2',60,true],['B2','Type 2',60,false],['C3','Type 2',22,false]]],
    [17,'Asoke Intersection Hub',13.7371,100.5602,9.90,4.7,true,true,H24,A.wrcl,
      [['A1','CCS2',180,true],['B2','CCS2',180,true],['C3','CCS2',120,false],['D4','CHAdeMO',60,true]]],
    [18,'Bangna Trad Express',13.6820,100.5820,7.10,4.0,true,false,H6,A.rlv,
      [['A1','CCS2',120,false],['B2','Type 2',60,false],['C3','Type 2',22,false]]],
    [19,'Onnut Local Charger',13.7058,100.5802,6.60,3.9,false,true,H7,A.wcs,
      [['A1','Type 2',22,true],['B2','Type 2',22,true]]],
    [20,'Suvarnabhumi Airport Hub',13.6840,100.5330,11.50,4.8,true,true,H24,A.wrcl,
      [['A1','CCS2',180,true],['B2','CCS2',180,true],['C3','CCS2',120,true],['D4','CHAdeMO',60,false],['E5','Type 2',22,true]]]
  ];

  // Reference point used for "distance from you" in the prototype.
  const ORIGIN = { lat: 13.7563, lng: 100.5018 };

  function km(a, b) {
    const dLat = (b.lat - a.lat) * 110.57;
    const dLng = (b.lng - a.lng) * 107.55; // cos(13.75°) corrected
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  const STATIONS = rows.map(function (r, i) {
    const chargers = r[10].map(function (c, ci) {
      return { id: i * 10 + ci + 1, charger_code: c[0], connector_type: c[1], power_kw: c[2], is_available: c[3] };
    });
    const available = chargers.filter(function (c) { return c.is_available; }).length;
    const dist = km(ORIGIN, { lat: r[2], lng: r[3] });
    return {
      id: r[0],
      name: r[1],
      address: (100 + i) + ' Charging Road, Bangkok',
      city: 'Bangkok',
      latitude: r[2],
      longitude: r[3],
      image_url: null,
      description: 'A modern EV charging hub with fast and standard chargers, a waiting lounge, and nearby amenities.',
      rating: r[5],
      price_per_kwh: r[4],
      has_fast_charge: r[6],
      is_open: r[7],
      opening_hours: r[8],
      amenities: r[9],
      chargers: chargers,
      // derived, for the prototype only
      available_count: r[7] ? available : 0,
      charger_count: chargers.length,
      max_power_kw: Math.max.apply(null, chargers.map(function (c) { return c.power_kw; })),
      distance_km: Math.round(dist * 10) / 10,
      eta_min: Math.max(3, Math.round(dist * 3.6))
    };
  });

  root.VG = root.VG || {};
  root.VG.ORIGIN = ORIGIN;
  root.VG.STATIONS = STATIONS;
  root.VG.byId = function (id) { return STATIONS.filter(function (s) { return s.id === id; })[0] || STATIONS[0]; };
})(typeof window !== 'undefined' ? window : this);
