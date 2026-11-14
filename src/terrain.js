// Fetch real elevations once for each endpoint pair, then route locally as slope
// limits, assumed speed or user exclusion zones change. Never invent terrain.
let terrainGrid = null,
  terrainResult = null,
  terrainSignature = "",
  terrainSequence = 0,
  terrainZonePick = false;
let lunarExclusionZones = [];
const terrainKey = () =>
  JSON.stringify([lunarRoutePoints.A, lunarRoutePoints.B]);
function showTerrainReport() {
  for (const id of [
    "terraindistance",
    "terraintime",
    "terrainascent",
    "terrainslope",
  ])
    $(id).textContent = "—";
  $("terrainprofile").replaceChildren();
  if (terrainResult?.status === "ok") {
    $("terraindistance").textContent =
      terrainResult.distance_km.toFixed(3) + " km";
    $("terraintime").textContent = formatRouteTime(terrainResult.travel_hours);
    $("terrainascent").textContent =
      terrainResult.ascent_m.toFixed(0) +
      " m up / " +
      terrainResult.descent_m.toFixed(0) +
      " m down";
    $("terrainslope").textContent =
      terrainResult.max_path_slope_degrees.toFixed(1) + "°";
    $("terrainstatus").textContent =
      terrainResult.source +
      " · analysis cells up to " +
      (terrainResult.analysis_grid_max_step_km * 1000).toFixed(0) +
      " m. Cyan path avoids mapped steep cells and marked exclusions inside this patch.";
    // A normalized elevation profile with real horizontal-distance/elevation labels.
    const elevations = terrainResult.profile.map((p) => p.elevation_m),
      low = Math.min(...elevations),
      high = Math.max(...elevations),
      span = Math.max(1, high - low),
      length = Math.max(1e-9, terrainResult.distance_km);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 280 90");
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-label",
      "Elevation profile: " +
        low.toFixed(0) +
        " to " +
        high.toFixed(0) +
        " metres over " +
        length.toFixed(2) +
        " kilometres",
    );
    const line = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    line.setAttribute(
      "points",
      terrainResult.profile
        .map(
          (p) =>
            5 +
            (270 * p.distance_km) / length +
            "," +
            (78 - (68 * (p.elevation_m - low)) / span),
        )
        .join(" "),
    );
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#76e0da");
    line.setAttribute("stroke-width", "2");
    svg.append(line);
    $("terrainprofile").append(svg);
    const caption = document.createElement("p");
    caption.className = "tiny";
    caption.textContent =
      "Profile: " +
      low.toFixed(0) +
      " to " +
      high.toFixed(0) +
      " m · 0 to " +
      length.toFixed(2) +
      " km";
    $("terrainprofile").append(caption);
  } else if (terrainResult) {
    $("terrainstatus").textContent = terrainResult.message;
  }
  renderSurfaceMap();
}
function recalculateTerrain() {
  if (!terrainGrid || terrainSignature !== terrainKey()) return;
  try {
    if (
      !$("routespeed").checkValidity() ||
      !$("maxrouteslope").checkValidity() ||
      !$("maxrouteslope").value
    )
      throw Error("Enter a positive speed and slope limit (0–45°).");
    terrainResult = planTerrainRoute(
      terrainGrid,
      lunarRoutePoints.A,
      lunarRoutePoints.B,
      +$("routespeed").value,
      +$("maxrouteslope").value,
      lunarExclusionZones,
    );
  } catch (error) {
    terrainResult = { status: "invalid", message: error.message };
  }
  showTerrainReport();
}
function invalidateTerrain() {
  terrainSequence++;
  terrainGrid = null;
  terrainResult = null;
  terrainSignature = terrainKey();
  $("terrainstatus").textContent =
    "Endpoints changed. Analyze terrain to load a new LOLA patch.";
  showTerrainReport();
}
const refreshSphericalRoute = refreshRouteSummary;
refreshRouteSummary = function () {
  if (terrainSignature !== terrainKey()) invalidateTerrain();
  refreshSphericalRoute();
  if (terrainGrid) recalculateTerrain();
};
const exportSphericalRoute = getLunarRouteExport;
getLunarRouteExport = function () {
  const report = exportSphericalRoute();
  return report
    ? {
        ...report,
        terrain: terrainResult,
        exclusion_zones: lunarExclusionZones.map((zone) => ({ ...zone })),
        terrain_scope:
          "Terrain is a separate regional DEM analysis. A null terrain result means terrain has not been calculated for these endpoints.",
      }
    : null;
};
$("analyzeterrain").onclick = async () => {
  const base = exportSphericalRoute();
  if (!base) {
    $("terrainstatus").textContent =
      "Select both endpoints and enter a valid speed first.";
    return;
  }
  if (
    base.distance_km > 30 ||
    Math.abs(base.start.lat) > 85 ||
    Math.abs(base.end.lat) > 85
  ) {
    $("terrainstatus").textContent =
      "Terrain routing supports routes up to 30 km within ±85° latitude. Spherical distance is still available outside these limits.";
    return;
  }
  const signature = terrainKey(),
    request = ++terrainSequence;
  terrainResult = null;
  showTerrainReport();
  $("analyzeterrain").disabled = true;
  $("terrainstatus").textContent =
    "Loading measured LRO LOLA elevations for this region…";
  try {
    const response = await fetch(
      "/api/lunar-terrain?" +
        new URLSearchParams({
          alat: base.start.lat,
          alon: base.start.lon,
          blat: base.end.lat,
          blon: base.end.lon,
        }),
    );
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Elevation source unavailable");
    if (request !== terrainSequence || signature !== terrainKey()) return;
    terrainGrid = data;
    terrainSignature = signature;
    recalculateTerrain();
  } catch (error) {
    if (request === terrainSequence) {
      terrainGrid = null;
      terrainResult = {
        status: "unavailable",
        message: "Terrain unavailable: " + error.message,
      };
      showTerrainReport();
    }
  } finally {
    $("analyzeterrain").disabled = false;
  }
};
$("maxrouteslope").addEventListener("input", () => {
  recalculateTerrain();
});
function renderExclusionList() {
  $("routezones").replaceChildren();
  lunarExclusionZones.forEach((zone, i) => {
    const item = document.createElement("div"),
      remove = document.createElement("button");
    item.className = "route-zone-item";
    item.textContent =
      "Zone " +
      (i + 1) +
      ": " +
      zone.lat.toFixed(3) +
      "°, " +
      zone.lon.toFixed(3) +
      "° · " +
      zone.radiusKm +
      " km ";
    remove.textContent = "Remove";
    remove.onclick = () => {
      lunarExclusionZones.splice(i, 1);
      renderExclusionList();
      recalculateTerrain();
      renderSurfaceMap();
    };
    item.append(remove);
    $("routezones").append(item);
  });
}
$("addroutezone").onclick = () => {
  if (!$("routezoneradius").value || !$("routezoneradius").reportValidity())
    return;
  terrainZonePick = !terrainZonePick;
  $("addroutezone").setAttribute("aria-pressed", String(terrainZonePick));
  $("terrainstatus").textContent = terrainZonePick
    ? "Click the atlas to mark the center of a known obstacle/exclusion zone."
    : "Obstacle picking canceled.";
};
const pickRouteEndpoint = canvas.onclick;
canvas.onclick = (event) => {
  if (!routeToolActive || !terrainZonePick) {
    pickRouteEndpoint(event);
    return;
  }
  const bounds = canvas.getBoundingClientRect(),
    lat = Math.max(
      -90,
      Math.min(
        90,
        center[1] +
          ((0.5 - (event.clientY - bounds.top) / bounds.height) * 180) / z,
      ),
    ),
    lon = Math.max(
      -180,
      Math.min(
        180,
        center[0] +
          (((event.clientX - bounds.left) / bounds.width - 0.5) * 360) / z,
      ),
    );
  if (lunarExclusionZones.length >= 20) {
    $("terrainstatus").textContent =
      "Maximum 20 exclusion zones. Remove an existing zone first.";
    return;
  }
  const radius = +$("routezoneradius").value;
  if (!Number.isFinite(radius) || radius <= 0 || radius > 10) {
    $("terrainstatus").textContent =
      "Exclusion radius must be above 0 and at most 10 km.";
    return;
  }
  lunarExclusionZones.push({ lat, lon, radiusKm: radius });
  terrainZonePick = false;
  $("addroutezone").setAttribute("aria-pressed", "false");
  renderExclusionList();
  recalculateTerrain();
  renderSurfaceMap();
};
const drawSphericalRoute = renderSurfaceMap;
renderSurfaceMap = function () {
  drawSphericalRoute();
  if (!routeToolActive || getSelectedBody()[2] !== 301) return;
  const width = canvas.clientWidth,
    height = canvas.clientHeight,
    project = (p) => ({
      x: ((p.lon - (center[0] - 180 / z)) / (360 / z)) * width,
      y: ((center[1] + 90 / z - p.lat) / (180 / z)) * height,
    });
  ctx.save();
  for (const zone of lunarExclusionZones) {
    const p = project(zone),
      latRadius = zone.radiusKm / ((1737.4 * Math.PI) / 180),
      lonRadius =
        latRadius / Math.max(0.02, Math.cos((zone.lat * Math.PI) / 180));
    ctx.beginPath();
    ctx.ellipse(
      p.x,
      p.y,
      Math.max(2, (lonRadius / (360 / z)) * width),
      Math.max(2, (latRadius / (180 / z)) * height),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "#ef6d8744";
    ctx.fill();
    ctx.strokeStyle = "#ff8fa5";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (terrainResult?.status === "ok") {
    ctx.strokeStyle = "#76e0da";
    ctx.lineWidth = 3;
    ctx.beginPath();
    let previous = null;
    for (const p of terrainResult.path) {
      const xy = project(p);
      if (!previous || Math.abs(p.lon - previous.lon) > 180)
        ctx.moveTo(xy.x, xy.y);
      else ctx.lineTo(xy.x, xy.y);
      previous = p;
    }
    ctx.stroke();
  }
  ctx.restore();
};
const closeRouteWithoutTerrain = closeLunarRouteTool;
closeLunarRouteTool = function () {
  terrainZonePick = false;
  $("addroutezone").setAttribute("aria-pressed", "false");
  closeRouteWithoutTerrain();
};
const clearEndpoints = $("clearroute").onclick;
$("clearroute").onclick = () => {
  lunarExclusionZones = [];
  terrainZonePick = false;
  $("addroutezone").setAttribute("aria-pressed", "false");
  renderExclusionList();
  clearEndpoints();
};

for (const label of ["A", "B"])
  $("pickroute" + label).addEventListener("click", () => {
    terrainZonePick = false;
    $("addroutezone").setAttribute("aria-pressed", "false");
  });
$("focusterrain").onclick = () => {
  const a = lunarRoutePoints.A,
    b = lunarRoutePoints.B;
  if (!a || !b) return;
  const lonSpan = Math.abs(a.lon - b.lon),
    latSpan = Math.abs(a.lat - b.lat);
  if (lonSpan > 180) {
    z = 1;
    center = [0, 0];
  } else {
    z = Math.max(
      1,
      Math.min(
        512,
        0.65 *
          Math.min(
            360 / Math.max(0.08, lonSpan),
            180 / Math.max(0.08, latSpan),
          ),
      ),
    );
    center = [
      Math.max(-180 + 180 / z, Math.min(180 - 180 / z, (a.lon + b.lon) / 2)),
      Math.max(-90 + 90 / z, Math.min(90 - 90 / z, (a.lat + b.lat) / 2)),
    ];
  }
  renderSurfaceMap();
};

$("overviewtab").addEventListener("click", () => {
  terrainZonePick = false;
  $("addroutezone").setAttribute("aria-pressed", "false");
});
