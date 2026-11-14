// LRO LOLA LDEM_128 V3.0: 46080 × 23040, little-endian signed int16,
// pixel registered, north to south, east-positive 0–360°, elevation = DN × 0.5 m.
export const LOLA_IMAGE_URL =
  "https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_128.IMG";
export const LOLA_LABEL_URL =
  "https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_128.LBL";
const DEM_WIDTH = 46080,
  DEM_HEIGHT = 23040,
  DEM_PPD = 128,
  DEM_ROW_BYTES = 92160;
export function terrainRequestBounds(start, end) {
  for (const p of [start, end])
    if (
      !p ||
      !Number.isFinite(p.lat) ||
      !Number.isFinite(p.lon) ||
      Math.abs(p.lat) > 85 ||
      Math.abs(p.lon) > 180
    )
      throw Error(
        "Terrain routing supports latitudes within ±85° and longitudes within ±180°.",
      );
  const rad = Math.PI / 180,
    dlon = ((end.lon - start.lon + 540) % 360) - 180;
  const h =
    Math.sin(((end.lat - start.lat) * rad) / 2) ** 2 +
    Math.cos(start.lat * rad) *
      Math.cos(end.lat * rad) *
      Math.sin((dlon * rad) / 2) ** 2;
  const distance = 3474.8 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
  if (distance > 30)
    throw Error(
      "Terrain routing is limited to local routes up to 30 km. Move the endpoints closer; spherical distance remains available for longer routes.",
    );
  const margin = Math.max(1, distance * 0.15),
    degKm = 1737.4 * rad;
  const latMargin = margin / degKm,
    lonMargin = margin / (degKm * Math.cos(((start.lat + end.lat) / 2) * rad));
  const north = Math.min(85.5, Math.max(start.lat, end.lat) + latMargin),
    south = Math.max(-85.5, Math.min(start.lat, end.lat) - latMargin);
  const west = Math.min(start.lon, start.lon + dlon) - lonMargin,
    east = Math.max(start.lon, start.lon + dlon) + lonMargin;
  const firstRow = Math.max(0, Math.floor((90 - north) * DEM_PPD)),
    lastRow = Math.min(DEM_HEIGHT - 1, Math.floor((90 - south) * DEM_PPD));
  if (lastRow - firstRow > 255)
    throw Error(
      "Requested terrain band is too large. Move the endpoints closer.",
    );
  return {
    north,
    south,
    west,
    east,
    firstRow,
    lastRow,
    direct_distance_km: distance,
  };
}
export function decodeTerrainPatch(buffer, bounds) {
  const expected = (bounds.lastRow - bounds.firstRow + 1) * DEM_ROW_BYTES;
  if (buffer.byteLength !== expected)
    throw Error("Unexpected LOLA byte-range length.");
  const view = new DataView(buffer);
  const rows = Math.min(129, bounds.lastRow - bounds.firstRow + 1);
  const columns = Math.min(
    129,
    Math.max(3, Math.ceil((bounds.east - bounds.west) * DEM_PPD) + 1),
  );
  const latitudes = Array.from(
    { length: rows },
    (_, r) =>
      90 -
      (bounds.firstRow +
        Math.round((r * (bounds.lastRow - bounds.firstRow)) / (rows - 1)) +
        0.5) /
        DEM_PPD,
  );
  const longitudes = Array.from(
    { length: columns },
    (_, c) => bounds.west + ((bounds.east - bounds.west) * c) / (columns - 1),
  );
  const heights = [];
  for (let r = 0; r < rows; r++) {
    const nativeRow =
      bounds.firstRow +
      Math.round((r * (bounds.lastRow - bounds.firstRow)) / (rows - 1));
    for (let c = 0; c < columns; c++) {
      const lon = ((longitudes[c] % 360) + 360) % 360,
        col = Math.min(DEM_WIDTH - 1, Math.floor(lon * DEM_PPD));
      const value = view.getInt16(
        (nativeRow - bounds.firstRow) * DEM_ROW_BYTES + col * 2,
        true,
      );
      heights.push(value === -32768 ? null : value * 0.5);
    }
  }
  return {
    rows,
    columns,
    latitudes,
    longitudes,
    heights,
    source: "LRO LOLA LDEM_128 V3.0",
    source_url: LOLA_IMAGE_URL,
    label_url: LOLA_LABEL_URL,
    native_resolution_m: 236.901,
    vertical_scale_m: 0.5,
    bounds,
    direct_distance_km: bounds.direct_distance_km,
    notes:
      "Regional subset; grid may be downsampled to 129×129. Gridded/interpolated elevations; no boulder inventory. Terrain can be finer than this grid. Pixel-centered heights relative to lunar reference radius 1737.4 km.",
  };
}
export async function loadLunarTerrain(start, end, fetcher = fetch) {
  const bounds = terrainRequestBounds(start, end),
    first = bounds.firstRow * DEM_ROW_BYTES,
    last = (bounds.lastRow + 1) * DEM_ROW_BYTES - 1;
  const response = await fetcher(LOLA_IMAGE_URL, {
    headers: { Range: "bytes=" + first + "-" + last },
    signal: AbortSignal.timeout(45000),
  });
  const expected = "bytes " + first + "-" + last + "/2123366400";
  // Never accept a full 2 GB file or decode a mislabeled partial response.
  if (
    response.status !== 206 ||
    response.headers.get("content-range") !== expected
  ) {
    await response.body?.cancel();
    throw Error(
      "LOLA server did not provide the required byte range. Terrain data is unavailable; no terrain route was calculated.",
    );
  }
  const length = Number(response.headers.get("content-length"));
  if (length && length !== last - first + 1) {
    await response.body?.cancel();
    throw Error("Unexpected terrain response size.");
  }
  return decodeTerrainPatch(await response.arrayBuffer(), bounds);
}
