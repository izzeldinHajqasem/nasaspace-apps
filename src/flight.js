// Launch inputs and timeline presentation share the pure model in flight-model.js.
const launchPads = {
  kennedy: ["Kennedy Space Center · LC-39A", 28.6084, -80.6043],
  baikonur: ["Baikonur Cosmodrome", 45.9203, 63.3422],
  kourou: ["Guiana Space Centre", 5.236, -52.775],
  satish: ["Satish Dhawan Space Centre", 13.7199, 80.2304],
};
const flightInputIds = [
  "launchpad",
  "launchlat",
  "launchlon",
  "departure",
  "transfermode",
  "parking",
  "moondistance",
  "cruisedays",
  "ascent",
  "descentheight",
  "downspeed",
  "horizspeed",
];
function getFlightReport() {
  const target = getSelectedBody();
  for (const id of flightInputIds) {
    const element = $(id);
    if (!element.disabled && (!element.value || !element.checkValidity()))
      throw Error("Check launch and timeline inputs.");
  }
  return calculateFlightPlan({
    targetId: target[2],
    targetRadiusKm: target[3],
    targetGm: target[4],
    launchName:
      launchPads[$("launchpad").value]?.[0] || "Custom Earth launch site",
    launchLatitude: +$("launchlat").value,
    launchLongitude: +$("launchlon").value,
    departureUtc: $("departure").value,
    mode: $("transfermode").value,
    parkingAltitudeKm: +$("parking").value,
    lunarDistanceKm: +$("moondistance").value,
    manualCruiseDays: +$("cruisedays").value,
    ascentMinutes: +$("ascent").value,
    descentHeightKm: +$("descentheight").value,
    downwardSpeedMs: +$("downspeed").value,
    horizontalSpeedMs: +$("horizspeed").value,
  });
}
function renderFlightPlan() {
  const lunarMode = $("transfermode").value === "lunar";
  $("parking").disabled = !lunarMode;
  $("moondistance").disabled = !lunarMode;
  $("cruisedays").disabled = lunarMode;
  try {
    const plan = getFlightReport();
    $("flighttime").textContent =
      (plan.total_seconds / 86400).toFixed(3) + " Earth days";
    $("touchdown").textContent = plan.estimated_touchdown_utc
      .replace("T", " ")
      .replace("Z", " UTC");
    $("approachangle").textContent =
      plan.approach_angle_below_horizontal_deg.toFixed(2) +
      "° below horizontal";
    $("targetescape").textContent =
      plan.destination_surface_escape_kms.toFixed(3) + " km/s";
    $("launchdetails").textContent =
      plan.launch.name +
      " · " +
      plan.launch.latitude_deg.toFixed(4) +
      "° N, " +
      plan.launch.longitude_east_deg.toFixed(4) +
      "° E · Eastward surface rotation speed " +
      plan.earth_rotation_eastward_speed_ms.toFixed(1) +
      " m/s (not a modeled launch benefit).";
    $("timelineparts").textContent =
      "Ascent assumption: " +
      (plan.ascent_seconds / 60).toFixed(1) +
      " min · Cruise: " +
      (plan.cruise_seconds / 86400).toFixed(3) +
      " d · Terminal descent assumption: " +
      (plan.descent_seconds / 60).toFixed(1) +
      " min · Descent ground distance: " +
      plan.descent_ground_distance_km.toFixed(2) +
      " km.";
    $("flightstatus").textContent =
      plan.mode === "lunar"
        ? "Ideal Earth-centered half-ellipse to assumed lunar distance; arrival alignment is not solved."
        : "Timeline uses your supplied cruise duration; no transfer trajectory was calculated.";
    $("usearrival").disabled = false;
  } catch (error) {
    for (const id of [
      "flighttime",
      "touchdown",
      "approachangle",
      "targetescape",
    ])
      $(id).textContent = "—";
    $("timelineparts").textContent = "";
    $("flightstatus").textContent = error.message;
    $("usearrival").disabled = true;
  }
}
$("launchpad").onchange = () => {
  const pad = launchPads[$("launchpad").value];
  if (pad) {
    $("launchlat").value = pad[1];
    $("launchlon").value = pad[2];
  }
  renderFlightPlan();
};
for (const id of flightInputIds.filter((id) => id !== "launchpad")) {
  $(id).addEventListener("input", () => {
    if (id === "launchlat" || id === "launchlon")
      $("launchpad").value = "custom";
    renderFlightPlan();
  });
}
for (const id of ["body", "cid", "cr", "cmu"])
  $(id).addEventListener("change", renderFlightPlan);
$("usearrival").onclick = () => {
  try {
    $("date").value = getFlightReport().estimated_touchdown_utc.slice(0, 16);
    $("date").dispatchEvent(new Event("change"));
    $("flightstatus").textContent =
      "Mission epoch set to estimated touchdown (rounded down to the minute). Analyze or find landing options to refresh Horizons data.";
  } catch (error) {
    $("flightstatus").textContent = error.message;
  }
};
renderFlightPlan();

// Preserve export usability when a partially edited timeline is invalid.
function getFlightExport() {
  try {
    return getFlightReport();
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
