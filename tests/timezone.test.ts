// Booking times must not depend on the zone the process runs in. Vercel runs
// in UTC, so `npm run test:tz` forces TZ=UTC; the helpers have to produce
// Bangkok wall-clock values anyway.
import { addDays, bangkokDate, bangkokDay, bangkokTime } from "../src/lib/timezone";
import { dateTime, dayOfMonth, monthShort, time } from "../src/lib/format";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

console.log(`\n=== Time zone helpers (process TZ=${process.env.TZ ?? "unset"}) ===`);
check("suite runs in UTC", new Date(0).getTimezoneOffset() === 0, `offset ${new Date(0).getTimezoneOffset()}`);

const slot = bangkokDate("2026-10-09", "16:30");
check("16:30 Bangkok is 09:30 UTC", slot.toISOString() === "2026-10-09T09:30:00.000Z", slot.toISOString());
check("and reads back as 16:30", bangkokTime(slot) === "16:30" && time(slot) === "16:30", `${bangkokTime(slot)} / ${time(slot)}`);
check("dateTime shows the Bangkok day and time", dateTime(slot) === "9 Oct · 16:30", dateTime(slot));

const late = bangkokDate("2026-10-09", "23:30");
check("23:30 Bangkok is still the 9th in Bangkok", bangkokDay(late) === "2026-10-09" && dayOfMonth(late) === "9", `${bangkokDay(late)} ${dayOfMonth(late)}`);
check("while it is the 9th 16:30 in UTC", late.toISOString() === "2026-10-09T16:30:00.000Z");

const early = new Date("2026-10-09T18:00:00Z"); // 01:00 on the 10th in Bangkok
check("UTC evening is already tomorrow in Bangkok", bangkokDay(early) === "2026-10-10", bangkokDay(early));
check("day badge follows Bangkok", dayOfMonth(early) === "10" && monthShort(early) === "Oct");

const midnight = bangkokDate("2026-10-10");
check("Bangkok midnight is 17:00 UTC the day before", midnight.toISOString() === "2026-10-09T17:00:00.000Z", midnight.toISOString());

// The reported bug: at 15:31 Bangkok the 08:00 slot was struck out (correct)
// but so was everything up to 15:30 UTC, i.e. 22:30 Bangkok.
const at1531 = bangkokDate("2026-10-09", "15:31").getTime();
check("08:00 has passed at 15:31", bangkokDate("2026-10-09", "08:00").getTime() < at1531);
check("16:00 has not passed at 15:31", bangkokDate("2026-10-09", "16:00").getTime() > at1531);

check("addDays crosses months", addDays("2026-10-31", 1) === "2026-11-01");
check("addDays crosses years", addDays("2026-12-31", 1) === "2027-01-01");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
