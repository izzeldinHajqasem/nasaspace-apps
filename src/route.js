// The airplane opens a Moon-only measuring mode on the georeferenced atlas.
let routeToolActive = false,
  routePick = "A",
  lunarRoutePoints = { A: null, B: null };
function getLunarRouteExport() {
  try {
    return calculateLunarRoute(
      lunarRoutePoints.A,
      lunarRoutePoints.B,
      +$("routespeed").value,
    );
  } catch {
    return null;
  }
}
function formatRouteTime(hours) {
  if (hours === 0) return "0 min";
  if (hours < 1 / 60) return "Less than 1 min";
  if (hours > 1e6) return hours.toExponential(2) + " hours";
  const minutes = Math.ceil(hours * 60),
    days = Math.floor(minutes / 1440),
    remaining = minutes % 1440;
  return [
    days ? days + " d" : "",
    Math.floor(remaining / 60) ? Math.floor(remaining / 60) + " h" : "",
    remaining % 60 ? (remaining % 60) + " min" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
function refreshRouteSummary() {
  for (const point of ["A", "B"]) {
    $("pickroute" + point).classList.toggle("active", routePick === point);
    $("pickroute" + point).setAttribute(
      "aria-pressed",
      String(routePick === point),
    );
  }
  $("routedistance").textContent = "—";
  $("routetime").textContent = "—";
  const report = getLunarRouteExport();
  if (report) {
    $("routedistance").textContent =
      report.distance_km.toLocaleString(undefined, {
        maximumFractionDigits: 3,
      }) + " km";
    $("routetime").textContent = formatRouteTime(report.travel_hours);
    $("routestatus").textContent = routePick
      ? "Click the atlas to replace point " + routePick + "."
      : "Route measured. Choose A or B to move an endpoint.";
  } else if (lunarRoutePoints.A && lunarRoutePoints.B) {
    $("routestatus").textContent = "Enter a valid speed greater than zero.";
  } else
    $("routestatus").textContent =
      "Click the atlas to place point " +
      (routePick || "A") +
      ". You can also enter coordinates.";
  renderSurfaceMap();
}
function setLunarRoutePoint(label, point) {
  validateLunarPoint(point);
  lunarRoutePoints[label] = { ...point };
  $("route" + label + "lat").value = point.lat.toFixed(5);
  $("route" + label + "lon").value = point.lon.toFixed(5);
  routePick = label === "A" && !lunarRoutePoints.B ? "B" : null;
  refreshRouteSummary();
}
function openLunarRouteTool() {
  selectDestination(301);
  setAtlasView(true);
  $("tooldrawer").hidden = true;
  routeToolActive = true;
  $("explorerview").classList.add("route-measuring");
  $("lunarroutepanel").hidden = false;
  $("routeplane").setAttribute("aria-pressed", "true");
  if (
    window.innerWidth <= 760 &&
    !$("explorerview").classList.contains("inspector-collapsed")
  )
    $("toggleinspector").click();
  if (!lunarRoutePoints.A) routePick = "A";
  refreshRouteSummary();
}
function closeLunarRouteTool() {
  routeToolActive = false;
  $("explorerview").classList.remove("route-measuring");
  routePick = null;
  $("lunarroutepanel").hidden = true;
  $("routeplane").setAttribute("aria-pressed", "false");
  renderSurfaceMap();
}
$("routeplane").onclick = () =>
  routeToolActive ? closeLunarRouteTool() : openLunarRouteTool();
$("closeroute").onclick = () => {
  closeLunarRouteTool();
  $("routeplane").focus();
};
for (const label of ["A", "B"]) {
  $("pickroute" + label).onclick = () => {
    routePick = label;
    refreshRouteSummary();
  };
  for (const suffix of ["lat", "lon"])
    $("route" + label + suffix).addEventListener("input", () => {
      const lat = $("route" + label + "lat"),
        lon = $("route" + label + "lon");
      lunarRoutePoints[label] = null;
      if (
        lat.value !== "" &&
        lon.value !== "" &&
        lat.checkValidity() &&
        lon.checkValidity()
      )
        lunarRoutePoints[label] = { lat: +lat.value, lon: +lon.value };
      routePick = null;
      refreshRouteSummary();
      if (!lunarRoutePoints[label])
        $("routestatus").textContent =
          "Enter valid latitude and longitude for point " + label + ".";
    });
}
$("routespeed").addEventListener("input", refreshRouteSummary);
$("clearroute").onclick = () => {
  lunarRoutePoints = { A: null, B: null };
  routePick = "A";
  for (const label of ["A", "B"])
    for (const suffix of ["lat", "lon"]) $("route" + label + suffix).value = "";
  refreshRouteSummary();
};
$("routefromsite").onclick = () =>
  setLunarRoutePoint("A", { lat: +$("lat").value, lon: +$("lon").value });
$("body").addEventListener("change", () => {
  if (getSelectedBody()[2] !== 301) closeLunarRouteTool();
});
$("overviewtab").addEventListener("click", closeLunarRouteTool);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && routeToolActive) closeLunarRouteTool();
});
const selectLandingPoint = canvas.onclick;
canvas.onclick = (event) => {
  if (!routeToolActive) {
    selectLandingPoint(event);
    return;
  }
  if (!routePick) {
    $("routestatus").textContent =
      "Choose “Pick A” or “Pick B” before moving a point.";
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  setLunarRoutePoint(routePick, {
    lat: Math.max(
      -90,
      Math.min(
        90,
        center[1] +
          ((0.5 - (event.clientY - bounds.top) / bounds.height) * 180) / z,
      ),
    ),
    lon: Math.max(
      -180,
      Math.min(
        180,
        center[0] +
          (((event.clientX - bounds.left) / bounds.width - 0.5) * 360) / z,
      ),
    ),
  });
};
const renderMapWithoutRoute = renderSurfaceMap;
renderSurfaceMap = function () {
  renderMapWithoutRoute();
  if (!routeToolActive || getSelectedBody()[2] !== 301) return;
  const width = canvas.clientWidth,
    height = canvas.clientHeight;
  const project = (point) => ({
    x: ((point.lon - (center[0] - 180 / z)) / (360 / z)) * width,
    y: ((center[1] + 90 / z - point.lat) / (180 / z)) * height,
  });
  ctx.save();
  if (lunarRoutePoints.A && lunarRoutePoints.B) {
    const arc = sampleLunarArc(lunarRoutePoints.A, lunarRoutePoints.B);
    ctx.strokeStyle = "#c5d4ff";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    let previous = null;
    for (const point of arc) {
      const p = project(point);
      if (!previous || Math.abs(point.lon - previous.lon) > 180)
        ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
      previous = point;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const label of ["A", "B"]) {
    const point = lunarRoutePoints[label];
    if (!point) continue;
    const p = project(point);
    ctx.fillStyle = label === "A" ? "#d5eb91" : "#aabfff";
    ctx.strokeStyle = "#131827";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(label, p.x + 14, p.y - 12);
  }
  ctx.restore();
};
window.addEventListener("resize", () => {
  if (routeToolActive) renderSurfaceMap();
});
for (const button of document.querySelectorAll("[data-tool],[data-home]"))
  button.addEventListener("click", () => {
    if (routeToolActive) closeLunarRouteTool();
  });
document.querySelector(".nav-brand").addEventListener("click", () => {
  if (routeToolActive) closeLunarRouteTool();
});
