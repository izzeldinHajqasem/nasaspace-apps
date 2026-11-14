import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  terrainRequestBounds,
  decodeTerrainPatch,
  loadLunarTerrain,
} from "../src/terrain-service.mjs";
import worker from "../dist/server/index.mjs";
const root = new URL("../src/", import.meta.url);
const context = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(new URL("route-model.js", root), "utf8") +
    fs.readFileSync(new URL("terrain-model.js", root), "utf8"),
  context,
);
const plan = context.planTerrainRoute;
function grid(size = 21) {
  return {
    rows: size,
    columns: size,
    latitudes: Array.from({ length: size }, (_, i) => 0.1 - i * 0.01),
    longitudes: Array.from({ length: size }, (_, i) => -0.1 + i * 0.01),
    heights: Array(size * size).fill(0),
    source: "Synthetic test only",
    native_resolution_m: 300,
  };
}
const g = grid(),
  start = { lat: 0, lon: -0.09 },
  end = { lat: 0, lon: 0.09 };
let r = plan(g, start, end, 5, 15, []);
assert.equal(r.status, "ok");
assert.ok(
  Math.abs(
    r.distance_km - context.calculateLunarRoute(start, end, 5).distance_km,
  ) < 1e-5,
);
assert.equal(r.ascent_m, 0);
const obstacle = { lat: 0, lon: 0, radiusKm: 0.6 };
r = plan(g, start, end, 5, 15, [obstacle]);
assert.equal(r.status, "ok");
assert.ok(r.distance_km > 6);
assert.ok(
  r.path.every(
    (p) =>
      context.calculateLunarRoute(p, obstacle, 1).distance_km >
      obstacle.radiusKm,
  ),
);
// A whole blocked column must not be bypassed by diagonal corner-cutting.
const gap = grid();
for (let row = 0; row < gap.rows; row++)
  gap.heights[row * gap.columns + 10] = null;
assert.equal(plan(gap, start, end, 5, 15, []).status, "no_path");
const ridge = grid();
for (let row = 0; row < ridge.rows; row++)
  ridge.heights[row * ridge.columns + 10] = 10000;
assert.equal(plan(ridge, start, end, 5, 15, []).status, "no_path");
const ramp = grid();
ramp.heights = ramp.heights.map((_, i) => (i % ramp.columns) * 10);
r = plan(ramp, start, end, 5, 15, []);
assert.equal(r.status, "ok");
assert.ok(r.ascent_m > 0);
assert.ok(r.distance_km > r.ground_distance_km);
assert.ok(r.travel_hours > r.distance_km / 5);
const identical = plan(g, start, start, 5, 15, []);
assert.equal(identical.distance_km, 0);
assert.throws(() => plan(g, start, end, 5, 0, []));
assert.equal(
  plan(g, start, end, 5, 15, [{ ...start, radiusKm: 1 }]).status,
  "blocked_endpoint",
);
assert.throws(() => terrainRequestBounds({ lat: 86, lon: 0 }, end));
assert.throws(() =>
  terrainRequestBounds({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }),
);
const bounds = terrainRequestBounds(
  { lat: 0, lon: -0.02 },
  { lat: 0, lon: 0.02 },
);
const buffer = new ArrayBuffer((bounds.lastRow - bounds.firstRow + 1) * 92160);
new Int16Array(buffer).fill(100);
const patch = decodeTerrainPatch(buffer, bounds);
assert.ok(patch.heights.every((h) => h === 50));
await assert.rejects(
  () =>
    loadLunarTerrain(
      start,
      end,
      async () => new Response("not a range", { status: 200 }),
    ),
  /byte range/,
);
const response = await worker.fetch(
  new Request(
    "http://local/api/lunar-terrain?alat=.674&alon=23.473&blat=.724&blon=23.573",
  ),
);
const live = await response.json();
assert.equal(response.status, 200, JSON.stringify(live));
assert.match(live.source, /LOLA/);
assert.ok(live.heights.every((h) => h === null || Math.abs(h) < 16000));
assert.ok(new Set(live.heights).size > 10);
const actual = plan(
  live,
  { lat: 0.674, lon: 23.473 },
  { lat: 0.724, lon: 23.573 },
  5,
  15,
  [],
);
assert.equal(actual.status, "ok", actual.message);
assert.ok(
  actual.distance_km >=
    context.calculateLunarRoute(actual.start, actual.end, 5).distance_km -
      0.001,
);
assert.ok(actual.ascent_m + actual.descent_m > 0);
const bad = await worker.fetch(
  new Request("http://local/api/lunar-terrain?alat=0&alon=0&blat=0&blon=90"),
);
assert.equal(bad.status, 400);
console.log(
  JSON.stringify({
    checks: "terrain passed",
    real_dem: live.source,
    path_km: actual.distance_km,
    ascent_m: actual.ascent_m,
    descent_m: actual.descent_m,
    time_hours: actual.travel_hours,
  }),
);
