import assert from "node:assert/strict";
import { createHorizonsClient } from "../src/horizons-client.mjs";
const success = () => Response.json({ result: "test response" });
let calls = 0;
const delays = [];
const recovering = createHorizonsClient({
  fetcher: async () => {
    calls++;
    return calls < 3 ? new Response("", { status: 503 }) : success();
  },
  wait: async (ms) => delays.push(ms),
});
assert.equal((await recovering.request("recover")).result, "test response");
assert.equal(calls, 3);
assert.deepEqual(delays, [2000, 5000]);
assert.equal((await recovering.request("recover")).cache_hit, true);
assert.equal(calls, 3);
let time = 0,
  failedCalls = 0;
const failing = createHorizonsClient({
  now: () => time,
  fetcher: async () => {
    failedCalls++;
    return new Response("", { status: 503 });
  },
  wait: async () => {},
});
await assert.rejects(
  failing.request("down"),
  (error) => error.temporary && error.retryAfterSeconds === 30,
);
assert.equal(failedCalls, 3);
await assert.rejects(failing.request("down"), (error) => error.temporary);
assert.equal(failedCalls, 3);
time = 31000;
await assert.rejects(failing.request("down"));
assert.equal(failedCalls, 6);
let active = 0,
  maximum = 0,
  serialCalls = 0;
const serial = createHorizonsClient({
  fetcher: async () => {
    active++;
    maximum = Math.max(maximum, active);
    serialCalls++;
    await Promise.resolve();
    active--;
    return success();
  },
});
await Promise.all([
  serial.request("one"),
  serial.request("two"),
  serial.request("one"),
]);
assert.equal(maximum, 1);
assert.equal(serialCalls, 2);
let limitedCalls = 0;
const limited = createHorizonsClient({
  fetcher: async () => {
    limitedCalls++;
    return new Response("", { status: 429, headers: { "Retry-After": "120" } });
  },
  wait: async () => {
    throw Error("Must not wait/retry before Retry-After");
  },
});
await assert.rejects(
  limited.request("limited"),
  (error) => error.retryAfterSeconds === 120,
);
assert.equal(limitedCalls, 1);
let invalidCalls = 0;
const invalid = createHorizonsClient({
  fetcher: async () => {
    invalidCalls++;
    return new Response("", { status: 400 });
  },
});
await assert.rejects(invalid.request("bad"), /Check the target/);
assert.equal(invalidCalls, 1);
let networkCalls = 0;
const network = createHorizonsClient({
  fetcher: async () => {
    networkCalls++;
    throw Error("network");
  },
  wait: async () => {},
});
await assert.rejects(network.request("network"), (error) => error.temporary);
assert.equal(networkCalls, 3);
let cacheTime = 0,
  cacheCalls = 0;
const expiry = createHorizonsClient({
  now: () => cacheTime,
  fetcher: async () => {
    cacheCalls++;
    return success();
  },
});
await expiry.request("cache");
cacheTime = 16 * 60 * 1000;
await expiry.request("cache");
assert.equal(cacheCalls, 2);
// Verify the public route reports a retryable outage and never fabricates data.
const originalFetch = globalThis.fetch,
  originalTimeout = globalThis.setTimeout;
let upstream = 0;
globalThis.fetch = async () => {
  upstream++;
  return new Response("", { status: 503 });
};
globalThis.setTimeout = (fn, ms, ...args) => originalTimeout(fn, 0, ...args);
try {
  const worker = (await import("../dist/server/index.mjs?outage-test")).default;
  const request = new Request(
    "http://local/api/horizons?body=301&lat=0&lon=0&date=2026-11-14T00:00&days=1&detail=1",
  );
  const response = await worker.fetch(request);
  const data = await response.json();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "30");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(data.temporary, true);
  assert.equal(data.sun, undefined);
  assert.equal(upstream, 3);
} finally {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalTimeout;
}
console.log(
  "Horizons resilience passed: 503 recovery, bounded retry, serialization, deduplication, cache expiry, cooldown, Retry-After and honest API outage responses.",
);
