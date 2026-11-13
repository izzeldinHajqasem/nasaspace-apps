import assert from "node:assert/strict";
import { candidates, objectives, scoreSite } from "./recommend.mjs";
import worker from "../dist/server/index.mjs";
const rank = (purpose, aim) =>
  candidates(301)
    .map((s) => scoreSite(s, objectives(purpose, aim), 14, "solar"))
    .sort((a, b) => b.score - a.score);
assert.match(rank("resources", "Find water ice")[0].name, /Shackleton/);
assert.match(
  rank("technology", "Test rover instruments")[0].name,
  /Tranquillitatis/,
);
assert.equal(candidates(705).length, 3);
assert.equal(candidates(705)[0].curated, false);
let s = { ...candidates(301)[0], light: 0.1, comm: 1 };
assert.ok(
  scoreSite(s, [1, 1, 1, 1], 30, "solar").score <
    scoreSite(s, [1, 1, 1, 1], 30, "independent").score,
);
const r = await worker.fetch(
  new Request(
    "http://local/api/horizons?body=301&lat=-89.5&lon=0&date=2026-11-13T00:00&days=14",
  ),
);
let d = await r.json();
assert.equal(r.status, 200, JSON.stringify(d));
assert.equal(d.sun.samples.length, 25);
assert.equal(d.earth.samples.length, 25);
assert.match(d.sun.samples.at(-1).epoch, /2026-Nov-27/);
const bad = await worker.fetch(
  new Request(
    "http://local/api/horizons?body=301&lat=0&lon=0&date=2026-11-13T00:00&days=9999",
  ),
);
assert.equal(bad.status, 400);
console.log(
  "Recommendation ranking, duration weighting, fallback candidates, 25 live samples and duration validation passed.",
);
