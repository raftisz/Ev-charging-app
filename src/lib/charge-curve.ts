/**
 * How a charging session progresses over time.
 *
 * A battery does not take full power all the way: a DC fast charger runs near
 * its rated power while the battery is low, then the car asks for less and
 * less as it fills (the "taper"), most sharply above 80%. AC chargers are
 * limited by the car's onboard charger instead and stay almost flat until the
 * battery is nearly full. This module models that shape, so a session's
 * energy, battery level, power and time to target all come from one curve.
 *
 * Pure and dependency-free: the server uses it to project an active session,
 * and the browser uses the same function to draw the power chart, so the two
 * always agree.
 */

/** Share of rated power the car accepts at a given battery level, DC charging. */
const DC_CURVE: [soc: number, share: number][] = [
  [0, 0.92],
  [10, 1],
  [45, 1],
  [55, 0.86],
  [70, 0.7],
  [80, 0.5],
  [90, 0.28],
  [100, 0.1],
];

/** AC charging stays flat until the battery is nearly full. */
const AC_CURVE: [soc: number, share: number][] = [
  [0, 1],
  [92, 1],
  [100, 0.35],
];

/** Below this rating a charger is treated as AC. */
const DC_THRESHOLD_KW = 50;

/** Integration step. Fifteen seconds keeps a two-hour session under 500 steps. */
const STEP_MIN = 0.25;

function interpolate(curve: [number, number][], soc: number) {
  const x = Math.max(0, Math.min(100, soc));
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    const [x0, y0] = curve[i - 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return curve[curve.length - 1][1];
}

/** Power (kW) the car draws at `soc` percent on a charger rated `ratedKw`. */
export function powerAt(ratedKw: number, soc: number) {
  const curve = ratedKw >= DC_THRESHOLD_KW ? DC_CURVE : AC_CURVE;
  return ratedKw * interpolate(curve, soc);
}

export type CurveInput = {
  ratedKw: number;
  batteryKwh: number;
  startPercent: number;
  targetPercent: number;
};

export type CurvePoint = {
  minute: number;
  soc: number;
  kw: number;
  energyKwh: number;
};

/** The session's state `minutes` after it started. Stops at the target. */
export function progressAt(input: CurveInput, minutes: number): CurvePoint {
  let soc = input.startPercent;
  let energy = 0;
  let t = 0;
  const target = Math.max(input.startPercent, input.targetPercent);
  while (t < minutes && soc < target) {
    const dt = Math.min(STEP_MIN, minutes - t);
    const kw = powerAt(input.ratedKw, soc);
    const add = Math.min((kw * dt) / 60, ((target - soc) / 100) * input.batteryKwh);
    energy += add;
    soc += (add / input.batteryKwh) * 100;
    t += dt;
  }
  const done = soc >= target - 1e-6;
  return {
    minute: minutes,
    soc: Math.min(soc, target),
    kw: done ? 0 : powerAt(input.ratedKw, soc),
    energyKwh: energy,
  };
}

/** Minutes from the start until the target is reached. */
export function minutesToReach(input: CurveInput) {
  let soc = input.startPercent;
  let t = 0;
  const target = Math.max(input.startPercent, input.targetPercent);
  // Twelve hours is a ceiling for even the slowest AC charge.
  while (soc < target - 1e-6 && t < 720) {
    const kw = Math.max(0.1, powerAt(input.ratedKw, soc));
    soc += ((kw * STEP_MIN) / 60 / input.batteryKwh) * 100;
    t += STEP_MIN;
  }
  return t;
}

/** Evenly spaced points from the start to `untilMinute`, for a chart. */
export function curvePoints(input: CurveInput, untilMinute: number, count = 48): CurvePoint[] {
  const end = Math.max(untilMinute, 1);
  return Array.from({ length: count + 1 }, (_, i) => progressAt(input, (end * i) / count));
}
