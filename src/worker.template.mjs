const HTML = __HTML__;
const IMAGE = __IMG__;
const REFERENCE_ASSETS = __ASSETS__;
__TERRAIN_SERVICE__;
__HORIZONS_CLIENT__;
// Request observer ephemerides at a geodetic surface coordinate (height: 0 km).
export async function ephemeris(
  body,
  lat,
  lon,
  date,
  target,
  days = 0,
  intervalMinutes = 0,
) {
  const start = new Date(date + "Z");
  if (!Number.isFinite(+start)) throw Error("Invalid UTC epoch");
  const stamp = (d) => d.toISOString().slice(0, 16).replace("T", " ");
  const params = new URLSearchParams({
    format: "json",
    COMMAND: "'" + target + "'",
    CENTER: "'coord@" + body + "'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: "'" + lon + "," + lat + ",0'",
    START_TIME: "'" + stamp(start) + "'",
    STOP_TIME:
      "'" + stamp(new Date(+start + (days ? days * 86400000 : 3600000))) + "'",
    // A numeric step requests 24 intervals: 25 samples including both endpoints.
    STEP_SIZE: intervalMinutes
      ? "'" + intervalMinutes + " m'"
      : days
        ? "'24'"
        : "'1 h'",
    QUANTITIES: "'4,20'",
    CSV_FORMAT: "'YES'",
    APPARENT: "'AIRLESS'",
  });
  const data = await horizonsClient.request(
    "https://ssd.jpl.nasa.gov/api/horizons.api?" + params,
  );
  const raw = data.result || "";
  const match = raw.match(/\$\$SOE\s*\n([^\n]+)/);
  if (!match)
    throw Error(
      "No surface ephemeris for this target or date. " + raw.slice(-250),
    );
  // Horizons CSV columns: UTC, solar flag, lunar flag, azimuth, elevation, range.
  const row = match[1].split(",");
  const values = {
    azimuth: Number(row[3]),
    elevation: Number(row[4]),
    rangeAU: Number(row[5]),
  };
  if (
    ![values.azimuth, values.elevation, values.rangeAU].every(Number.isFinite)
  )
    throw Error("Unexpected Horizons response");
  const samples = raw
    .split("$$SOE")[1]
    .split("$$EOE")[0]
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      let r = line.split(",");
      return {
        epoch: r[0].trim(),
        azimuth: Number(r[3]),
        elevation: Number(r[4]),
        rangeAU: Number(r[5]),
      };
    });
  if (
    !samples.length ||
    samples.some(
      (s) => ![s.azimuth, s.elevation, s.rangeAU].every(Number.isFinite),
    )
  )
    throw Error("Invalid time samples");
  return {
    ...values,
    samples,
    raw,
    cache_hit: data.cache_hit,
    retrieved_at_utc: data.retrieved_at_utc,
  };
}
export default {
  async fetch(request) {
    const u = new URL(request.url);
    if (u.pathname === "/api/lunar-terrain") {
      try {
        const names = ["alat", "alon", "blat", "blon"];
        if (
          names.some(
            (name) =>
              !u.searchParams.has(name) ||
              u.searchParams.get(name).trim() === "",
          )
        )
          return Response.json(
            { error: "Both terrain endpoints are required." },
            { status: 400 },
          );
        const values = names.map((name) => Number(u.searchParams.get(name)));
        const start = { lat: values[0], lon: values[1] },
          end = { lat: values[2], lon: values[3] };
        try {
          terrainRequestBounds(start, end);
        } catch (error) {
          return Response.json({ error: error.message }, { status: 400 });
        }
        const patch = await loadLunarTerrain(start, end);
        return Response.json(patch, {
          headers: { "Cache-Control": "public,max-age=86400" },
        });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 502 });
      }
    }
    if (u.pathname === "/api/horizons") {
      try {
        const b = u.searchParams.get("body"),
          lat = Number(u.searchParams.get("lat")),
          lon = Number(u.searchParams.get("lon")),
          date = u.searchParams.get("date");
        if (
          !/^\d{3,9}$/.test(b || "") ||
          !Number.isFinite(lat) ||
          Math.abs(lat) > 90 ||
          !Number.isFinite(lon) ||
          Math.abs(lon) > 180 ||
          !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(date || "")
        )
          return Response.json(
            { error: "Invalid target, coordinates, or epoch" },
            { status: 400 },
          );
        const days = Number(u.searchParams.get("days") || 0);
        if (
          !Number.isFinite(days) ||
          days < 0 ||
          days > 3650 ||
          (days !== 0 && !Number.isInteger(days))
        )
          return Response.json(
            { error: "Duration must be 1–3650 whole Earth days" },
            { status: 400 },
          );
        const detailed = u.searchParams.get("detail") === "1";
        if (detailed && (!days || days > 60))
          return Response.json(
            { error: "Detailed visibility requires 1–60 whole days." },
            { status: 400 },
          );
        const intervalMinutes = detailed ? (days <= 7 ? 15 : 60) : 0;
        const sun = await ephemeris(
          b,
          lat,
          lon,
          date,
          10,
          days,
          intervalMinutes,
        );
        const earth = await ephemeris(
          b,
          lat,
          lon,
          date,
          399,
          days,
          intervalMinutes,
        );
        if (detailed) {
          delete sun.raw;
          delete earth.raw;
        }
        return Response.json(
          {
            interval_minutes: intervalMinutes,
            source: "NASA/JPL Horizons",
            epoch: date,
            sun,
            earth,
          },
          { headers: { "Cache-Control": "public, max-age=300" } },
        );
      } catch (e) {
        const temporary = Boolean(e.temporary);
        return Response.json(
          {
            error: e.message,
            temporary,
            retry_after_seconds: e.retryAfterSeconds || null,
          },
          {
            status: temporary ? 503 : 502,
            headers: temporary
              ? {
                  "Retry-After": String(e.retryAfterSeconds || 30),
                  "Cache-Control": "no-store",
                }
              : { "Cache-Control": "no-store" },
          },
        );
      }
    }
    if (REFERENCE_ASSETS[u.pathname]) {
      const bytes = Uint8Array.from(atob(REFERENCE_ASSETS[u.pathname]), (c) =>
        c.charCodeAt(0),
      );
      return new Response(bytes, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public,max-age=86400",
        },
      });
    }
    if (u.pathname === "/moon.jpg") {
      const bytes = Uint8Array.from(atob(IMAGE), (c) => c.charCodeAt(0));
      return new Response(bytes, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public,max-age=86400",
        },
      });
    }
    if (u.pathname !== "/" && u.pathname !== "/index.html")
      return new Response("Not found", { status: 404 });
    return new Response(HTML, {
      headers: { "Content-Type": "text/html;charset=utf-8" },
    });
  },
};
