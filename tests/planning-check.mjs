import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import worker from "../dist/server/index.mjs";
const source = readFileSync(
  new URL("../src/planning-model.js", import.meta.url),
  "utf8",
);
const { calculateDeltaVBudget, summarizeHorizonWindow } = vm.runInNewContext(
  source + "\n({calculateDeltaVBudget,summarizeHorizonWindow})",
);
const budget = calculateDeltaVBudget(
  [
    { name: "Departure", vehicle: "Transfer", deltaV: 3150 },
    { name: "Corrections", vehicle: "Transfer", deltaV: 50 },
    { name: "Capture", vehicle: "Transfer", deltaV: 900 },
    { name: "Landing", vehicle: "Lander", deltaV: 1900 },
  ],
  15,
);
assert.equal(budget.subtotal_ms, 6000);
assert.equal(budget.reserve_ms, 900);
assert.ok(Math.abs(budget.total_ms - 6900) < 1e-8);
assert.ok(
  Math.abs(budget.vehicles.find((v) => v.name === "Lander").total_ms - 2185) <
    1e-8,
);
assert.throws(() =>
  calculateDeltaVBudget([{ vehicle: "Lander", deltaV: -1 }], 15),
);
assert.throws(() => calculateDeltaVBudget([], 101));
const samples = (elevations) =>
  elevations.map((elevation, i) => ({
    epoch: "2026-Nov-14 " + String(i).padStart(2, "0") + ":00",
    elevation,
  }));
const horizon = summarizeHorizonWindow(samples([-10, 10, -10]));
assert.equal(horizon.above_horizon_hours, 1);
assert.equal(horizon.above_horizon_percent, 50);
assert.equal(horizon.longest_above_horizon_hours, 1);
assert.equal(horizon.next_rise_utc, "2026-11-14T00:30:00.000Z");
assert.equal(horizon.next_set_utc, "2026-11-14T01:30:00.000Z");
assert.equal(
  summarizeHorizonWindow(samples([1, 2, 1])).above_horizon_percent,
  100,
);
assert.equal(
  summarizeHorizonWindow(samples([-1, -2, -1])).above_horizon_percent,
  0,
);
assert.equal(summarizeHorizonWindow(samples([1, 2, 1])).next_set_utc, null);
assert.equal(
  summarizeHorizonWindow(samples([1, 0, -1])).above_horizon_hours,
  1,
);
assert.throws(() => summarizeHorizonWindow([]));
async function live(days, lon) {
  const response = await worker.fetch(
    new Request(
      "http://local/api/horizons?" +
        new URLSearchParams({
          body: 301,
          lat: 0.674,
          lon,
          date: "2026-11-14T00:00",
          days,
          detail: 1,
        }),
    ),
  );
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}
const detailed = await live(30, 23.473);
assert.equal(detailed.interval_minutes, 60);
assert.equal(detailed.sun.samples.length, 721);
assert.equal(detailed.sun.raw, undefined);
const sun = summarizeHorizonWindow(detailed.sun.samples),
  earth = summarizeHorizonWindow(detailed.earth.samples);
assert.ok(sun.above_horizon_hours > 300 && sun.above_horizon_hours < 400);
assert.ok(sun.next_set_utc);
assert.ok(sun.next_rise_utc);
assert.equal(earth.above_horizon_percent, 100);
assert.equal(earth.next_set_utc, null);
const farside = await live(1, 180);
assert.equal(farside.interval_minutes, 15);
assert.equal(farside.sun.samples.length, 97);
assert.equal(
  summarizeHorizonWindow(farside.earth.samples).above_horizon_percent,
  0,
);
const invalid = await worker.fetch(
  new Request(
    "http://local/api/horizons?body=301&lat=0&lon=0&date=2026-11-14T00:00&days=61&detail=1",
  ),
);
assert.equal(invalid.status, 400);
console.log(
  "Planning checks passed: vehicle Δv/reserve math, crossing interpolation, continuous visibility cases, live 30-day sunlight and near/far-side Earth visibility.",
);
