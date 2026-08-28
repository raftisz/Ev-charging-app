/**
 * Resets and repopulates the Volt Grid demo database.
 *
 *   npm run seed              wipe and reseed
 *   npm run seed -- --if-empty   seed only when the database has no stations
 *
 * The `--if-empty` form is what deploys run: the first boot fills an empty
 * database, and later deploys leave real accounts and sessions alone.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type {
  ChargerStatus,
  ConnectorType,
  StationStatus,
} from "../src/generated/prisma/enums";
import { STATION_ROWS, type ConnectorName } from "./stations";
import { parseDatabaseUrl, requireDatabaseUrl } from "../src/server/env";

const { connectionString, schema } = parseDatabaseUrl(requireDatabaseUrl());

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }, schema ? { schema } : undefined),
});

const CONNECTOR: Record<ConnectorName, ConnectorType> = {
  CCS2: "CCS2",
  "Type 2": "TYPE2",
  CHAdeMO: "CHADEMO",
};

const DEMO_PASSWORD = "password123";

const PEOPLE = [
  ["Somchai Patchara", "user1@example.com", "081 234 5678", "Tesla", "Model 3 Long Range", "กก 1234", 75],
  ["Nadia Chen", "user2@example.com", "082 118 4420", "BYD", "Atto 3", "งง 2210", 60.5],
  ["Kittipong Sae-Lim", "user3@example.com", "089 774 1902", "ORA", "Good Cat", "ขข 8871", 47.8],
  ["Pichaya Wongsawat", "user4@example.com", "086 220 7731", "MG", "MG4 Electric", "จจ 5510", 64],
  ["Thanapon Ritthirong", "user5@example.com", "080 991 3388", "Hyundai", "IONIQ 5", "ฉฉ 7420", 72.6],
  ["Arunee Srisuk", "user6@example.com", "084 553 2091", "Neta", "Neta V", "ชช 3092", 38.5],
  ["Wichai Boonmee", "user7@example.com", "087 661 4477", "Volvo", "EX30", "ซซ 1188", 69],
  ["Ploy Suwannarat", "user8@example.com", "081 445 9922", "Tesla", "Model Y", "ญญ 6633", 78.1],
] as const;

const OPERATORS = [
  ["Volt Grid Admin", "admin@example.com", "ADMIN"],
  ["Grid Operations", "operator@example.com", "OPERATOR"],
] as const;

/** Deterministic pseudo-random so reseeding produces the same demo story. */
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const rand = makeRng(20260824);
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
const round = (n: number, d = 2) => Number(n.toFixed(d));

function initials(name: string) {
  const parts = name.split(" ");
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Station status derived from how many of its chargers are usable. */
function stationStatusFor(isOpen: boolean, free: number, total: number, id: number): StationStatus {
  if (id === 13) return "MAINTENANCE";
  if (!isOpen) return "OFFLINE";
  if (free === 0) return "BUSY";
  return "AVAILABLE";
}

/**
 * The stations are inserted with explicit ids so the demo data is stable, but
 * an explicit id does not advance Postgres's identity sequence. Without this
 * the next `create()` would reuse id 1 and fail on the unique constraint.
 */
async function resyncSequences() {
  const tables = [
    "User", "Station", "Charger", "Connector",
    "Reservation", "ChargingSession", "Notification", "Favorite",
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(
         pg_get_serial_sequence('"${table}"', 'id'),
         COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1,
         false
       )`,
    );
  }
}

async function reset() {
  // Order matters: children first (SQLite cascades are on, but be explicit).
  await prisma.notification.deleteMany();
  await prisma.chargingSession.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.connector.deleteMany();
  await prisma.charger.deleteMany();
  await prisma.station.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  const onlyIfEmpty = process.argv.includes("--if-empty");

  if (onlyIfEmpty) {
    const existing = await prisma.station.count();
    if (existing > 0) {
      console.log(`Database already has ${existing} stations — skipping seed.`);
      return;
    }
    console.log("Database is empty — seeding demo data.");
  }

  console.log("• Clearing existing data");
  await reset();

  console.log("• Seeding users");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const users = [];
  for (const [fullName, email, phone, make, model, plate, battery] of PEOPLE) {
    users.push(
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          phone,
          role: "USER",
          avatarInit: initials(fullName),
          vehicleMake: make,
          vehicleModel: model,
          vehiclePlate: plate,
          batteryKwh: battery,
          walletBalance: round(400 + rand() * 1600, 0),
        },
      }),
    );
  }

  const staff = [];
  for (const [fullName, email, role] of OPERATORS) {
    staff.push(
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          role,
          avatarInit: initials(fullName),
          phone: "02 118 0000",
          walletBalance: 0,
        },
      }),
    );
  }

  console.log("• Seeding stations, chargers and connectors");
  const stations = [];
  for (const [index, row] of STATION_ROWS.entries()) {
    const [id, name, lat, lng, price, rating, , isOpen, hours, amenities, chargerSpecs] = row;
    const free = chargerSpecs.filter((c) => c[3]).length;
    const status = stationStatusFor(isOpen, isOpen ? free : 0, chargerSpecs.length, id);

    const station = await prisma.station.create({
      data: {
        id,
        name,
        address: `${100 + index} Charging Road, Bangkok`,
        latitude: lat,
        longitude: lng,
        status,
        openingHours: hours,
        pricePerKwh: price,
        rating,
        reviewCount: 40 + Math.floor(rand() * 320),
        amenities,
        imageHue: 200 + Math.floor(rand() * 60),
        chargers: {
          create: chargerSpecs.map(([code, connector, kw, available]) => {
            let chargerStatus: ChargerStatus = available ? "AVAILABLE" : "CHARGING";
            if (status === "MAINTENANCE") chargerStatus = "MAINTENANCE";
            else if (status === "OFFLINE") chargerStatus = "OFFLINE";
            return {
              chargerCode: code,
              powerKw: kw,
              status: chargerStatus,
              connectors: { create: [{ type: CONNECTOR[connector], powerKw: kw }] },
            };
          }),
        },
      },
      include: { chargers: true },
    });
    stations.push(station);
  }

  const byStationId = new Map(stations.map((s) => [s.id, s]));
  const primary = users[0];

  console.log("• Seeding favourites");
  for (const stationId of [1, 2, 8, 17]) {
    await prisma.favorite.create({ data: { userId: primary.id, stationId } });
  }
  for (const user of users.slice(1, 5)) {
    for (const stationId of [pick([1, 4, 5, 8]), pick([10, 11, 14, 20])]) {
      await prisma.favorite.upsert({
        where: { userId_stationId: { userId: user.id, stationId } },
        create: { userId: user.id, stationId },
        update: {},
      });
    }
  }

  console.log("• Seeding charging history");
  const now = new Date();
  const historyDays = 45;
  let sessionCount = 0;

  for (let day = historyDays; day >= 1; day--) {
    const perDay = 1 + Math.floor(rand() * 4);
    for (let n = 0; n < perDay; n++) {
      const station = pick(stations);
      const charger = pick(station.chargers);
      const user = day % 3 === 0 ? primary : pick(users);
      const start = new Date(now);
      start.setDate(start.getDate() - day);
      start.setHours(7 + Math.floor(rand() * 13), Math.floor(rand() * 60), 0, 0);

      const minutes = 22 + Math.floor(rand() * 70);
      const end = new Date(start.getTime() + minutes * 60_000);
      const power = Math.min(charger.powerKw, 22 + rand() * 130);
      const energy = round((power * minutes) / 60 / (1.4 + rand()), 2);
      const startPercent = 12 + Math.floor(rand() * 35);

      await prisma.chargingSession.create({
        data: {
          userId: user.id,
          stationId: station.id,
          chargerId: charger.id,
          status: "COMPLETED",
          startTime: start,
          endTime: end,
          startPercent,
          currentPercent: Math.min(95, startPercent + Math.floor(energy)),
          targetPercent: 80,
          energyKwh: energy,
          powerKw: round(power, 1),
          pricePerKwh: station.pricePerKwh,
          cost: round(energy * station.pricePerKwh, 2),
          paymentStatus: rand() > 0.06 ? "PAID" : "FAILED",
          paymentMethod: pick(["Volt Grid wallet", "Credit card", "PromptPay QR"]),
        },
      });
      sessionCount++;
    }
  }

  console.log("• Seeding the live session for the demo account");
  const liveStation = byStationId.get(8)!;
  const liveCharger = liveStation.chargers[0];
  // Started a few minutes ago and aiming from 20% to 80%, so a freshly seeded
  // demo shows a session that is genuinely mid-charge for roughly an hour.
  const liveMinutes = 7;
  const liveStart = new Date(now.getTime() - liveMinutes * 60_000);
  const livePower = Math.min(118, liveCharger.powerKw);
  const liveEnergy = round((livePower * 0.62 * liveMinutes) / 60, 2);

  await prisma.charger.update({
    where: { id: liveCharger.id },
    data: { status: "CHARGING" },
  });

  await prisma.chargingSession.create({
    data: {
      userId: primary.id,
      stationId: liveStation.id,
      chargerId: liveCharger.id,
      status: "ACTIVE",
      startTime: liveStart,
      startPercent: 20,
      currentPercent: 20 + Math.round((liveEnergy / 75) * 100),
      targetPercent: 80,
      energyKwh: liveEnergy,
      powerKw: livePower,
      pricePerKwh: liveStation.pricePerKwh,
      cost: round(liveEnergy * liveStation.pricePerKwh, 2),
      paymentStatus: "PENDING",
    },
  });

  console.log("• Seeding reservations");
  const upcoming = [
    { userId: primary.id, stationId: 2, hoursAhead: 5, minutes: 45 },
    { userId: primary.id, stationId: 17, hoursAhead: 30, minutes: 60 },
    { userId: users[1].id, stationId: 4, hoursAhead: 3, minutes: 30 },
    { userId: users[2].id, stationId: 11, hoursAhead: 8, minutes: 45 },
    { userId: users[3].id, stationId: 20, hoursAhead: 26, minutes: 60 },
    { userId: users[4].id, stationId: 5, hoursAhead: 52, minutes: 30 },
  ];

  for (const item of upcoming) {
    const station = byStationId.get(item.stationId)!;
    const charger = station.chargers.find((c) => c.status === "AVAILABLE") ?? station.chargers[0];
    const start = new Date(now.getTime() + item.hoursAhead * 3_600_000);
    start.setMinutes(start.getMinutes() < 30 ? 0 : 30, 0, 0);
    const end = new Date(start.getTime() + item.minutes * 60_000);
    const estimatedKwh = round((item.minutes / 60) * 28, 2);

    await prisma.reservation.create({
      data: {
        userId: item.userId,
        stationId: station.id,
        chargerId: charger.id,
        startTime: start,
        endTime: end,
        status: "CONFIRMED",
        estimatedKwh,
        reservationFee: 20,
        estimatedCost: round(estimatedKwh * station.pricePerKwh + 20, 2),
      },
    });
  }

  // A little past history so the reservation list has completed/cancelled rows.
  for (let i = 0; i < 10; i++) {
    const station = pick(stations);
    const charger = pick(station.chargers);
    const user = i % 2 === 0 ? primary : pick(users);
    const start = new Date(now.getTime() - (3 + i * 4) * 3_600_000);
    const end = new Date(start.getTime() + 45 * 60_000);
    const estimatedKwh = round(21, 2);
    await prisma.reservation.create({
      data: {
        userId: user.id,
        stationId: station.id,
        chargerId: charger.id,
        startTime: start,
        endTime: end,
        status: i % 4 === 0 ? "CANCELLED" : "COMPLETED",
        estimatedKwh,
        reservationFee: 20,
        estimatedCost: round(estimatedKwh * station.pricePerKwh + 20, 2),
      },
    });
  }

  console.log("• Seeding notifications");
  const notifications = [
    ["SESSION", "Charging started", "Rama IX Power Station · charger A1 is delivering 118 kW.", false],
    ["RESERVATION", "Reservation confirmed", "Siam Green Station · charger A1 is held for your slot.", false],
    ["PAYMENT", "Payment received", "฿284 charged to your Volt Grid wallet for session #1042.", true],
    ["SYSTEM", "New station nearby", "Suvarnabhumi Airport Hub now has three 180 kW chargers.", true],
    ["SESSION", "Session complete", "Asoke Intersection Hub · 33.4 kWh delivered in 41 minutes.", true],
  ] as const;
  for (const [type, title, body, isRead] of notifications) {
    await prisma.notification.create({
      data: { userId: primary.id, type, title, body, isRead },
    });
  }
  for (const user of users.slice(1)) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "SYSTEM",
        title: "Welcome to Volt Grid",
        body: "Find a station, reserve a charger and track every session in one place.",
      },
    });
  }

  console.log("• Resyncing id sequences");
  await resyncSequences();

  const counts = {
    users: await prisma.user.count(),
    stations: await prisma.station.count(),
    chargers: await prisma.charger.count(),
    connectors: await prisma.connector.count(),
    reservations: await prisma.reservation.count(),
    sessions: sessionCount + 1,
    notifications: await prisma.notification.count(),
    favorites: await prisma.favorite.count(),
  };

  console.log("\nSeed complete:", counts);
  console.log(`\nDemo accounts (password: ${DEMO_PASSWORD})`);
  console.log("  user1@example.com     driver with a live charging session");
  console.log("  admin@example.com     full admin dashboard");
  console.log("  operator@example.com  operator (read + station management)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
