const HTML = __HTML__;
const IMAGE = __IMG__;
// Request observer ephemerides at a geodetic surface coordinate (height: 0 km).
export async function ephemeris(body, lat, lon, date, target, days = 0) {
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
    STEP_SIZE: days ? "'24'" : "'1 h'",
    QUANTITIES: "'4,20'",
    CSV_FORMAT: "'YES'",
    APPARENT: "'AIRLESS'",
  });
  const response = await fetch(
    "https://ssd.jpl.nasa.gov/api/horizons.api?" + params,
    { signal: AbortSignal.timeout(25000) },
  );
  if (!response.ok) throw Error("JPL service returned " + response.status);
  const data = await response.json();
  if (data.error) throw Error(data.error.slice(0, 350));
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
  return { ...values, samples, raw };
}
export default {
  async fetch(request) {
    const u = new URL(request.url);
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
        const [sun, earth] = await Promise.all([
          ephemeris(b, lat, lon, date, 10, days),
          ephemeris(b, lat, lon, date, 399, days),
        ]);
        return Response.json(
          { source: "NASA/JPL Horizons", epoch: date, sun, earth },
          { headers: { "Cache-Control": "public, max-age=300" } },
        );
      } catch (e) {
        return Response.json({ error: e.message }, { status: 502 });
      }
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
