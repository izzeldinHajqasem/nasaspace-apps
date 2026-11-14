import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(
  new URL("../src/flight-model.js", import.meta.url),
  "utf8",
);
const calculate = vm.runInNewContext(source + "\ncalculateFlightPlan");
const input = {
  targetId: 301,
  targetRadiusKm: 1737.4,
  targetGm: 4902.800118,
  launchName: "Kennedy",
  launchLatitude: 28.6084,
  launchLongitude: -80.6043,
  departureUtc: "2026-12-31T23:00",
  mode: "lunar",
  parkingAltitudeKm: 200,
  lunarDistanceKm: 384400,
  manualCruiseDays: 3,
  ascentMinutes: 12,
  descentHeightKm: 10,
  downwardSpeedMs: 50,
  horizontalSpeedMs: 10,
};
const plan = calculate(input);
assert.ok(
  plan.cruise_seconds / 86400 > 4.9 && plan.cruise_seconds / 86400 < 5.1,
);
assert.ok(Math.abs(plan.destination_surface_escape_kms - 2.376) < 0.002);
assert.ok(
  Math.abs(plan.approach_angle_below_horizontal_deg - 78.6900675) < 1e-5,
);
assert.equal(plan.descent_seconds, 200);
assert.equal(plan.total_seconds, 720 + plan.cruise_seconds + 200);
assert.equal(
  Date.parse(plan.estimated_touchdown_utc),
  Math.trunc(Date.parse(input.departureUtc + "Z") + plan.total_seconds * 1000),
);
assert.equal(
  calculate({ ...input, horizontalSpeedMs: 0 })
    .approach_angle_below_horizontal_deg,
  90,
);
assert.equal(
  calculate({ ...input, launchLatitude: 0 }).total_seconds,
  plan.total_seconds,
);
assert.throws(() => calculate({ ...input, downwardSpeedMs: 0 }));
assert.throws(
  () => calculate({ ...input, targetId: 499 }),
  /only for the Moon/,
);
assert.throws(() => calculate({ ...input, lunarDistanceKm: 6000 }));
const manual = calculate({ ...input, targetId: 499, mode: "manual" });
assert.equal(manual.cruise_seconds, 3 * 86400);
assert.equal(manual.ideal_injection_speed_kms, null);
assert.match(manual.estimated_touchdown_utc, /^2027-01-03/);
console.log(
  "Flight model passed: lunar time, descent angle, escape speed, launch metadata, UTC rollover, manual duration and invalid input.",
);
