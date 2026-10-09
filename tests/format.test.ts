// Money is always shown to the satang, never rounded to whole baht.
import { thb } from "../src/lib/format";

let pass = 0, fail = 0;
function check(name: string, actual: string, expected: string) {
  if (actual === expected) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} got ${actual}, want ${expected}`); }
}

console.log("\n=== thb ===");
check("keeps satang", thb(64.47), "฿64.47");
check("does not round up", thb(288.64), "฿288.64");
check("zero", thb(0), "฿0.00");
check("negative zero", thb(-0), "฿0.00");
check("whole baht gets .00", thb(249), "฿249.00");
check("one decimal is padded", thb(12.5), "฿12.50");
check("thousands separator", thb(1249.5), "฿1,249.50");
check("rounds to the nearest satang", thb(10.005 + 1e-9), "฿10.01");
check("per-kWh rate", thb(7.5), "฿7.50");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
