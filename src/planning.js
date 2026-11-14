// Editable Δv allocation. Values are illustrative lunar planning assumptions.
const budgetManeuvers = [
  ["budgetlaunch", "Earth surface → parking orbit", "Launch rocket"],
  ["budgetdeparture", "Departure / transfer injection", "Transfer vehicle"],
  ["budgetcorrections", "Course corrections", "Transfer vehicle"],
  ["budgetcapture", "Destination orbit insertion", "Transfer vehicle"],
  ["budgetlanding", "Descent and landing", "Lander"],
  ["budgetascent", "Surface ascent (return)", "Return vehicle"],
  ["budgetreturn", "Return departure", "Return vehicle"],
  ["budgetother", "Other maneuvers", "Transfer vehicle"],
];
let horizonReport = null,
  horizonRequest = 0;
function getBudgetReport() {
  for (const id of [...budgetManeuvers.map((row) => row[0]), "budgetreserve"]) {
    if (!$(id).value || !$(id).checkValidity())
      throw Error(
        "Enter nonnegative maneuver budgets and a reserve between 0 and 100%.",
      );
  }
  return calculateDeltaVBudget(
    budgetManeuvers.map(([id, name, vehicle]) => ({
      name,
      vehicle,
      deltaV: +$(id).value,
    })),
    +$("budgetreserve").value,
  );
}
function renderBudget() {
  try {
    const report = getBudgetReport();
    const number = (value) =>
      value.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " m/s";
    $("budgetsubtotal").textContent = number(report.subtotal_ms);
    $("budgetmargin").textContent = number(report.reserve_ms);
    $("budgettotal").textContent = number(report.total_ms);
    $("budgetvehicles").textContent = report.vehicles
      .map(
        (vehicle) =>
          vehicle.name + ": " + number(vehicle.total_ms) + " incl. reserve",
      )
      .join(" · ");
    $("budgetstatus").textContent =
      "Total Δv across vehicles. Use one vehicle’s allocation for the single-vehicle fuel estimate.";
    $("applybudget").disabled = false;
  } catch (error) {
    for (const id of ["budgetsubtotal", "budgetmargin", "budgettotal"])
      $(id).textContent = "—";
    $("budgetvehicles").textContent = "";
    $("budgetstatus").textContent = error.message;
    $("applybudget").disabled = true;
  }
}
for (const id of [...budgetManeuvers.map((row) => row[0]), "budgetreserve"])
  $(id).addEventListener("input", renderBudget);
$("applybudget").onclick = () => {
  try {
    const vehicle = getBudgetReport().vehicles.find(
      (vehicle) => vehicle.name === $("budgetvehicle").value,
    );
    $("dv").value = Math.ceil(vehicle.total_ms);
    $("dv").dispatchEvent(new Event("change"));
    $("budgetstatus").textContent =
      vehicle.name +
      " budget copied to vehicle Δv (rounded up). Set dry mass and Isp for this vehicle; staging and burn-by-burn mass changes are not modeled.";
  } catch (error) {
    $("budgetstatus").textContent = error.message;
  }
};
$("budgetpreset").onclick = () => {
  const values = [0, 3150, 50, 900, 1900, 0, 0, 0];
  budgetManeuvers.forEach(([id], i) => ($(id).value = values[i]));
  $("budgetreserve").value = 15;
  renderBudget();
};
function invalidateHorizonReport() {
  horizonRequest++;
  horizonReport = null;
  for (const id of [
    "sunsettime",
    "earthsettime",
    "sunlighthours",
    "earthvisibility",
    "sunrisetime",
    "earthrisetime",
    "longestsunlight",
  ])
    $(id).textContent = "—";
  for (const id of ["suntrack", "earthtrack"]) $(id).replaceChildren();
  $("horizonstatus").textContent =
    "Inputs changed. Calculate visibility to refresh this report.";
  $("horizonrange").textContent = "";
}
for (const id of ["body", "lat", "lon", "date", "cid", "horizondays"])
  $(id).addEventListener("input", invalidateHorizonReport);
for (const id of ["body", "lat", "lon", "date", "cid", "horizondays"])
  $(id).addEventListener("change", invalidateHorizonReport);
// Map clicks, historic presets, and recommendation selections also change the site.
const originalUpdateSelectedSite = updateSelectedSite;
updateSelectedSite = function () {
  originalUpdateSelectedSite();
  invalidateHorizonReport();
};
function renderVisibilityTrack(id, summary) {
  const track = $(id);
  track.replaceChildren();
  const start = Date.parse(summary.start_utc),
    span = Date.parse(summary.end_utc) - start;
  for (const interval of summary.intervals_utc) {
    const bar = document.createElement("span");
    bar.className = "visibility-segment";
    bar.style.left = ((Date.parse(interval.start) - start) / span) * 100 + "%";
    bar.style.width =
      ((Date.parse(interval.end) - Date.parse(interval.start)) / span) * 100 +
      "%";
    bar.title = interval.start + " → " + interval.end;
    track.append(bar);
  }
}
$("calculatevisibility").onclick = async () => {
  let target;
  try {
    target = validateMissionInputs();
    if (!$("horizondays").value || !$("horizondays").reportValidity())
      throw Error("Choose a visibility window from 1 to 60 whole Earth days.");
  } catch (error) {
    $("horizonstatus").textContent = error.message;
    return;
  }
  invalidateHorizonReport();
  invalidateLiveResults();
  const request = ++horizonRequest;
  const context = {
    target_id: target[2],
    latitude_deg: +$("lat").value,
    longitude_east_deg: +$("lon").value,
    epoch_utc: $("date").value,
    days: +$("horizondays").value,
  };
  $("calculatevisibility").disabled = true;
  $("horizonstatus").textContent =
    "Fetching dense Sun and Earth elevation samples from JPL Horizons…";
  try {
    const response = await fetch(
      "/api/horizons?" +
        new URLSearchParams({
          body: context.target_id,
          lat: context.latitude_deg,
          lon: context.longitude_east_deg,
          date: context.epoch_utc,
          days: context.days,
          detail: "1",
        }),
    );
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Horizons unavailable");
    if (request !== horizonRequest) return;
    applySiteEphemeris(data);
    const sun = summarizeHorizonWindow(data.sun.samples),
      earth = summarizeHorizonWindow(data.earth.samples);
    horizonReport = {
      ...context,
      source: "NASA/JPL Horizons",
      retrieval: {
        sun_utc: data.sun.retrieved_at_utc,
        earth_utc: data.earth.retrieved_at_utc,
        sun_cached: Boolean(data.sun.cache_hit),
        earth_cached: Boolean(data.earth.cache_hit),
      },
      sun,
      earth,
      limitations:
        "Geometric center above 0° only. Linear interpolation of elevation samples; crossings and durations are approximate. No terrain, refraction, solar/Earth angular radius, eclipses, occultation, antenna constraints or link budget.",
    };
    const utc = (value) =>
      value
        ? value.slice(0, 16).replace("T", " ") + " UTC"
        : "No crossing detected in window";
    $("sunsettime").textContent = utc(sun.next_set_utc);
    $("sunrisetime").textContent = utc(sun.next_rise_utc);
    $("earthsettime").textContent = utc(earth.next_set_utc);
    $("earthrisetime").textContent = utc(earth.next_rise_utc);
    $("sunlighthours").textContent =
      sun.above_horizon_hours.toFixed(1) +
      " h / " +
      sun.window_hours.toFixed(0) +
      " h (" +
      sun.above_horizon_percent.toFixed(1) +
      "%)";
    $("earthvisibility").textContent =
      earth.above_horizon_hours.toFixed(1) +
      " h (" +
      earth.above_horizon_percent.toFixed(1) +
      "%)";
    $("longestsunlight").textContent =
      sun.longest_above_horizon_hours.toFixed(1) + " h within window";
    $("horizonrange").textContent =
      sun.start_utc.slice(0, 16).replace("T", " ") +
      " → " +
      sun.end_utc.slice(0, 16).replace("T", " ") +
      " UTC";
    $("horizonstatus").textContent =
      "Retrieved " +
      sun.sample_count +
      " samples per body · spacing up to " +
      sun.max_sample_step_minutes +
      " min" +
      (data.sun.cache_hit || data.earth.cache_hit
        ? " · matching recent JPL response reused"
        : "") +
      ". Times are estimated to sample-scale precision. No crossing detected does not mean a body never sets.";
    renderVisibilityTrack("suntrack", sun);
    renderVisibilityTrack("earthtrack", earth);
  } catch (error) {
    if (request === horizonRequest) {
      const message = "Visibility unavailable: " + error.message;
      $("horizonstatus").textContent = message;
      $("status").textContent = message;
    }
  } finally {
    $("calculatevisibility").textContent = horizonReport
      ? "Calculate visibility ↗"
      : "Retry visibility ↗";
    $("calculatevisibility").disabled = false;
  }
};
function getPlanningExport() {
  let budget;
  try {
    budget = getBudgetReport();
  } catch (error) {
    budget = { valid: false, error: error.message };
  }
  return {
    delta_v_budget: budget,
    lunar_surface_route:
      typeof getLunarRouteExport === "function" ? getLunarRouteExport() : null,
    horizon_visibility: horizonReport,
  };
}
renderBudget();
