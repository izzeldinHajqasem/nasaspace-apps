import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(
  new URL("../src/route-model.js", import.meta.url),
  "utf8",
);
const { calculateLunarRoute, sampleLunarArc } = vm.runInNewContext(
  source + "\n({calculateLunarRoute,sampleLunarArc})",
);
const start = { lat: 0, lon: 0 },
  end = { lat: 0, lon: 90 };
const route = calculateLunarRoute(start, end, 5);
assert.ok(Math.abs(route.distance_km - (1737.4 * Math.PI) / 2) < 1e-8);
assert.equal(route.travel_hours, route.distance_km / 5);
assert.equal(calculateLunarRoute(start, start, 5).distance_km, 0);
assert.ok(
  Math.abs(
    calculateLunarRoute({ lat: 0, lon: 179 }, { lat: 0, lon: -179 }, 5)
      .distance_km -
      (1737.4 * Math.PI) / 90,
  ) < 1e-8,
);
assert.ok(
  Math.abs(
    calculateLunarRoute({ lat: 90, lon: 0 }, { lat: -90, lon: 0 }, 5)
      .distance_km -
      1737.4 * Math.PI,
  ) < 1e-8,
);
assert.throws(() => calculateLunarRoute(start, end, 0));
assert.throws(() => calculateLunarRoute(start, end, -1));
assert.throws(() => calculateLunarRoute({ lat: 91, lon: 0 }, end, 5));
assert.throws(() => calculateLunarRoute(null, end, 5));
for (const destination of [
  end,
  { lat: 0, lon: 180 },
  { lat: 45, lon: -125 },
  start,
]) {
  const points = sampleLunarArc(start, destination);
  assert.ok(
    points.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)),
  );
  const summed = points
    .slice(1)
    .reduce(
      (sum, p, i) => sum + calculateLunarRoute(points[i], p, 5).distance_km,
      0,
    );
  assert.ok(
    Math.abs(summed - calculateLunarRoute(start, destination, 5).distance_km) <
      0.001,
  );
}
console.log(
  "Lunar route checks passed: great-circle distance, speed/time, dateline, poles, antipodes, identical points, sampled path and invalid inputs.",
);
