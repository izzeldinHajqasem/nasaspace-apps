// JPL SSD fair-use policy: one upstream request at a time, cache unchanged
// queries, and back off on service unavailability. Queue/cache are per isolate.
export function createHorizonsClient({
  fetcher = fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  timeoutMs = 8000,
} = {}) {
  const cache = new Map(),
    inflight = new Map();
  let queue = Promise.resolve(),
    cooldownUntil = 0,
    pending = 0;
  const temporary = (retrySeconds = 30) =>
    Object.assign(
      new Error(
        "NASA JPL Horizons is temporarily busy or unavailable. Automatic retries did not succeed. Please try again in " +
          retrySeconds +
          " seconds.",
      ),
      { temporary: true, retryAfterSeconds: retrySeconds },
    );
  const cached = (url) => {
    const entry = cache.get(url);
    return entry && entry.expires > now()
      ? { ...entry.data, cache_hit: true, retrieved_at_utc: entry.retrieved }
      : null;
  };
  async function run(url) {
    const hit = cached(url);
    if (hit) return hit;
    if (cooldownUntil > now())
      throw temporary(Math.max(1, Math.ceil((cooldownUntil - now()) / 1000)));
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await wait(attempt === 1 ? 2000 : 5000);
      let response;
      try {
        response = await fetcher(url, {
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        if (attempt < 2) continue;
        cooldownUntil = now() + 30000;
        throw temporary();
      }
      if ([429, 500, 502, 503, 504].includes(response.status)) {
        const header = response.headers.get("retry-after");
        const retrySeconds = header
          ? Math.max(
              0,
              Number.isFinite(Number(header))
                ? Number(header)
                : Math.ceil((Date.parse(header) - now()) / 1000),
            )
          : 0;
        await response.body?.cancel();
        // Respect long Retry-After values without holding the UI request open.
        if (retrySeconds > 5) {
          cooldownUntil = now() + Math.min(3600, retrySeconds) * 1000;
          throw temporary(Math.min(3600, retrySeconds));
        }
        if (attempt < 2) {
          if (retrySeconds) await wait(retrySeconds * 1000);
          continue;
        }
        cooldownUntil = now() + 30000;
        throw temporary();
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw Error(
          "JPL rejected this request (HTTP " +
            response.status +
            "). Check the target and epoch.",
        );
      }
      let data;
      try {
        data = await response.json();
      } catch {
        if (attempt < 2) continue;
        cooldownUntil = now() + 30000;
        throw temporary();
      }
      if (data.error) throw Error(String(data.error).slice(0, 350));
      if (typeof data.result !== "string")
        throw Error("Unexpected Horizons response.");
      const retrieved = new Date(now()).toISOString();
      if (data.result.length < 1000000) {
        if (cache.size >= 32) cache.delete(cache.keys().next().value);
        cache.set(url, { data, retrieved, expires: now() + 15 * 60 * 1000 });
      }
      return { ...data, cache_hit: false, retrieved_at_utc: retrieved };
    }
  }
  return {
    request(url) {
      const hit = cached(url);
      if (hit) return Promise.resolve(hit);
      if (inflight.has(url)) return inflight.get(url);
      if (pending >= 16) return Promise.reject(temporary(30));
      pending++;
      const task = queue.then(() => run(url));
      queue = task.catch(() => {});
      const result = task.finally(() => {
        pending--;
        inflight.delete(url);
      });
      inflight.set(url, result);
      return result;
    },
  };
}
export const horizonsClient = createHorizonsClient();
