// The station photo list, the files in public/stations, the migration that
// fills Station.imageUrl on existing databases and docs/credits.md must all
// agree. A photo without a credit, or a URL without a file, fails here.
import fs from "node:fs";
import path from "node:path";
import { STATION_PHOTOS, stationPhotoAlt } from "../src/lib/station-photos";
import { STATION_ROWS } from "../prisma/stations";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

const root = path.resolve(import.meta.dirname, "..");
const entries = Object.entries(STATION_PHOTOS);

console.log("\n=== Station photos ===");
const seeded = STATION_ROWS.map((r) => r[1]);
check("every seeded station has a photo", seeded.every((n) => STATION_PHOTOS[n]), seeded.filter((n) => !STATION_PHOTOS[n]).join(", "));
check("no photo for a station that does not exist", entries.every(([n]) => seeded.includes(n)));
check("each station gets a different photo", new Set(entries.map(([, p]) => p.src)).size === entries.length);

const files = entries.map(([, p]) => path.join(root, "public", p.src));
const missing = files.filter((f) => !fs.existsSync(f));
check("every photo file exists in public/stations", missing.length === 0, missing.join(", "));
const isWebp = (f: string) => {
  const head = fs.readFileSync(f).subarray(0, 12);
  return head.subarray(0, 4).toString() === "RIFF" && head.subarray(8, 12).toString() === "WEBP";
};
check("every photo is a WebP file", files.every((f) => fs.existsSync(f) && isWebp(f)));
const big = files.filter((f) => fs.existsSync(f) && fs.statSync(f).size > 200 * 1024);
check("every photo is at most 200 KB", big.length === 0, big.map((f) => path.basename(f)).join(", "));
check("every photo has alt text", entries.every(([, p]) => p.alt.trim().length > 10));

const credits = fs.readFileSync(path.join(root, "docs/credits.md"), "utf8");
const uncredited = entries.filter(([, p]) => !credits.includes(path.basename(p.src)));
check("every photo is credited in docs/credits.md", uncredited.length === 0, uncredited.map(([n]) => n).join(", "));
const onDisk = fs.readdirSync(path.join(root, "public/stations"));
check("no unused files in public/stations", onDisk.every((f) => entries.some(([, p]) => p.src.endsWith(`/${f}`))), onDisk.join(", "));

const migrationDir = fs.readdirSync(path.join(root, "prisma/migrations")).find((d) => d.endsWith("_add_station_image_url"));
const sql = migrationDir ? fs.readFileSync(path.join(root, "prisma/migrations", migrationDir, "migration.sql"), "utf8") : "";
const pairs = [...sql.matchAll(/\('((?:[^']|'')+)', '([^']+)'\)/g)].map((m) => [m[1].replace(/''/g, "'"), m[2]]);
check("migration backfills every station", pairs.length === entries.length, `${pairs.length} vs ${entries.length}`);
check("migration matches the photo list", pairs.every(([n, u]) => STATION_PHOTOS[n]?.src === u));
check("migration only fills empty imageUrl", /"imageUrl" IS NULL/.test(sql));

console.log("\n=== Alt text ===");
const [name, photo] = entries[0];
check("known photo uses its description", stationPhotoAlt({ name, imageUrl: photo.src }) === photo.alt);
check("no photo still gets an alt", stationPhotoAlt({ name: "New Depot", imageUrl: null }) === "Charging bays at New Depot");
check("a replaced photo is not described with the old text", stationPhotoAlt({ name, imageUrl: "/stations/other.webp" }) === `Charging bays at ${name}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
