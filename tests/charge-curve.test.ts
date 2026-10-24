// The charge curve drives both the server's projection and the power chart.
import { curvePoints, minutesToReach, powerAt, progressAt } from "../src/lib/charge-curve";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

console.log("\n=== Power ===");
check("DC runs at full power mid-battery", powerAt(150, 30) === 150);
check("DC tapers above 80%", powerAt(150, 85) < powerAt(150, 75) && powerAt(150, 85) < 75);
check("DC tapers hard near full", powerAt(150, 99) < 25);
check("AC stays flat until nearly full", powerAt(7.4, 10) === 7.4 && powerAt(7.4, 90) === 7.4);
check("AC eases off at the top", powerAt(7.4, 98) < 7.4);
check("never above rated power", [0, 10, 30, 50, 70, 90, 100].every((s) => powerAt(120, s) <= 120 && powerAt(11, s) <= 11));

console.log("\n=== Progress ===");
const dc = { ratedKw: 150, batteryKwh: 75, startPercent: 20, targetPercent: 80 };
const total = minutesToReach(dc);
const end = progressAt(dc, total);
check("reaches the target", near(end.soc, 80, 0.5), String(end.soc));
check("energy matches the battery gained", near(end.energyKwh, 0.6 * 75, 0.5), String(end.energyKwh));
check("starts at the start", progressAt(dc, 0).soc === 20 && progressAt(dc, 0).energyKwh === 0);
check("never passes the target", progressAt(dc, total + 60).soc <= 80.01);
check("power is zero once the target is reached", progressAt(dc, total + 5).kw === 0, String(progressAt(dc, total + 5).kw));
check("20→80% on 150 kW takes 20–40 min", total > 20 && total < 40, String(total));
const slow = minutesToReach({ ...dc, startPercent: 80, targetPercent: 100 });
const fast = minutesToReach({ ...dc, startPercent: 20, targetPercent: 40 });
check("the last 20% takes longer than 20→40%", slow > fast * 2, `${slow} vs ${fast}`);
const ac = { ratedKw: 7.4, batteryKwh: 60, startPercent: 20, targetPercent: 80 };
check("AC 20→80% on 7.4 kW takes about 36·60/7.4 min", near(minutesToReach(ac), (36 / 7.4) * 60, 3), String(minutesToReach(ac)));
let prev = -1, monotonic = true;
for (let t = 0; t <= total; t += 1) { const s = progressAt(dc, t).soc; if (s < prev) monotonic = false; prev = s; }
check("battery level only goes up", monotonic);

console.log("\n=== Chart points ===");
const pts = curvePoints(dc, total, 48);
check("requested number of points", pts.length >= 48, String(pts.length));
check("points span the session", pts[0].minute === 0 && near(pts.at(-1)!.minute, total, 0.01));
check("points agree with progressAt", pts.every((p) => near(p.kw, progressAt(dc, p.minute).kw, 1e-9)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
