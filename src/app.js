// Destination catalogue, surface map, single-site analysis, and mission export.

// Body tuple: name, parent/type, Horizons ID, mean radius (km), GM (km³/s²).
const bodies = [
  ["Moon", "Earth", 301, 1737.4, 4902.800118, "moon"],
  ["Phobos", "Mars", 401, 11.266, 0.0007087],
  ["Deimos", "Mars", 402, 6.2, 0.0000962],
  ["Io", "Jupiter", 501, 1821.6, 5959.916],
  ["Europa", "Jupiter", 502, 1560.8, 3202.739],
  ["Ganymede", "Jupiter", 503, 2634.1, 9887.834],
  ["Callisto", "Jupiter", 504, 2410.3, 7179.289],
  ["Mimas", "Saturn", 601, 198.2, 2.5026],
  ["Enceladus", "Saturn", 602, 252.1, 7.2104],
  ["Tethys", "Saturn", 603, 531.1, 41.21],
  ["Dione", "Saturn", 604, 561.4, 73.112],
  ["Rhea", "Saturn", 605, 763.8, 153.94],
  ["Titan", "Saturn", 606, 2574.73, 8978.138],
  ["Iapetus", "Saturn", 608, 734.5, 120.51],
  ["Miranda", "Uranus", 705, 235.8, 4.4],
  ["Ariel", "Uranus", 701, 578.9, 86.4],
  ["Umbriel", "Uranus", 702, 584.7, 81.5],
  ["Titania", "Uranus", 703, 788.9, 228.2],
  ["Oberon", "Uranus", 704, 761.4, 192.4],
  ["Triton", "Neptune", 801, 1353.4, 1427.6],
  ["Charon", "Pluto", 901, 606, 105.88],
  ["Other moon / custom target", "Solar system", 0, 0, 0],
];
bodies.splice(
  bodies.length - 1,
  0,
  ["Mercury", "Rocky planet", 199, 2439.7, 22031.8686],
  ["Venus", "Rocky planet", 299, 6051.8, 324858.592],
  ["Mars", "Rocky planet", 499, 3389.5, 42828.375],
  ["Pluto", "Dwarf planet", 999, 1188.3, 869.6138],
);
const $ = (id) => document.getElementById(id);
bodies.forEach((b, i) => $("body").add(new Option(b[0] + " · " + b[1], i)));
let selectedName = "Apollo 11 · Sea of Tranquility",
  z = 1,
  center = [0, 0],
  image = new Image(),
  imageReady = false,
  last = null,
  seq = 0;
const canvas = $("map"),
  ctx = canvas.getContext("2d");
image.onload = () => {
  imageReady = true;
  renderSurfaceMap();
};
image.onerror = () => {
  $("credit").textContent = "Imagery unavailable · coordinate grid";
  renderSurfaceMap();
};
image.src = "/moon.jpg";
function getSelectedBody() {
  let b = bodies[+$("body").value];
  return b[2]
    ? b
    : [
        "Custom moon",
        "Custom",
        +$("cid").value,
        +$("cr").value,
        +$("cmu").value,
      ];
}
function validateMissionInputs() {
  for (const id of [
    "lat",
    "lon",
    "alt",
    "mass",
    "isp",
    "dv",
    "date",
    ...(bodies[+$("body").value][2] ? [] : ["cid", "cr", "cmu"]),
  ]) {
    let e = $(id);
    if (!e.value || !e.reportValidity())
      throw Error("Enter valid mission parameters.");
  }
  let b = getSelectedBody();
  if (!Number.isInteger(b[2]) || b[2] < 1 || b[3] <= 0 || b[4] <= 0)
    throw Error("Enter a satellite ID, positive radius, and positive GM.");
  return b;
}
// Spherical-body estimates; the entered Δv budget is a user assumption.
// Rocket equation uses dry mass and standard gravity (9.80665 m/s²).
function calculateMissionEstimates() {
  try {
    let b = validateMissionInputs(),
      r = b[3],
      mu = b[4],
      a = r + +$("alt").value,
      v = Math.sqrt(mu / a),
      t = (2 * Math.PI * Math.sqrt((a * a * a) / mu)) / 60,
      f =
        +$("mass").value *
        Math.expm1(+$("dv").value / (9.80665 * +$("isp").value));
    $("gravity").innerHTML =
      ((mu / r / r) * 1000).toFixed(3) + " <span>m/s²</span>";
    $("escape").innerHTML =
      Math.sqrt((2 * mu) / r).toFixed(3) + " <span>km/s</span>";
    $("period").innerHTML = t.toFixed(1) + " <span>min</span>";
    $("velocity").innerHTML = v.toFixed(3) + " <small>km/s</small>";
    $("fuel").innerHTML = Math.round(f).toLocaleString() + " <small>kg</small>";
    return {
      gravity: (mu / r / r) * 1000,
      escape_kms: Math.sqrt((2 * mu) / r),
      orbit_kms: v,
      period_min: t,
      propellant_kg: f,
    };
  } catch (e) {
    return null;
  }
}
// Increment the request sequence so stale API responses cannot replace newer inputs.
function invalidateLiveResults() {
  seq++;
  last = null;
  for (let id of ["sun", "earth", "range"]) $(id).textContent = "—";
  $("sunhint").textContent = "Analyze to retrieve illumination";
  $("earthhint").textContent = "Geometric line of sight";
  $("delay").textContent = "One-way light time: —";
  $("status").textContent =
    "Parameters changed. Analyze to refresh Horizons data.";
}
function updateSelectedSite() {
  let lat = +$("lat").value,
    lon = +$("lon").value;
  $("coords").textContent =
    Math.abs(lat).toFixed(3) +
    "° " +
    (lat < 0 ? "S" : "N") +
    "   " +
    Math.abs(lon).toFixed(3) +
    "° " +
    (lon < 0 ? "W" : "E");
  $("sitename").textContent = selectedName;
  renderSurfaceMap();
}
function renderSurfaceMap() {
  let w = canvas.clientWidth,
    h = canvas.clientHeight,
    dpr = devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#0c100e";
  ctx.fillRect(0, 0, w, h);
  let bounds = () => [
    center[0] - 180 / z,
    center[1] + 90 / z,
    360 / z,
    180 / z,
  ];
  let [left, top, span, vspan] = bounds();
  let px = (lon) => ((lon - left) / span) * w,
    py = (lat) => ((top - lat) / vspan) * h;
  if (getSelectedBody()[2] === 301 && imageReady) {
    ctx.globalAlpha = 0.85;
    ctx.drawImage(
      image,
      ((left + 180) / 360) * image.width,
      ((90 - top) / 180) * image.height,
      (span / 360) * image.width,
      (vspan / 180) * image.height,
      0,
      0,
      w,
      h,
    );
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = "#d4e4b52b";
  ctx.lineWidth = 0.6;
  ctx.fillStyle = "#d2dbc280";
  ctx.font = "9px monospace";
  for (let x = -180; x <= 180; x += 30) {
    ctx.beginPath();
    ctx.moveTo(px(x), 0);
    ctx.lineTo(px(x), h);
    ctx.stroke();
    ctx.fillText(x + "°", px(x) + 4, h - 8);
  }
  for (let y = -90; y <= 90; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, py(y));
    ctx.lineTo(w, py(y));
    ctx.stroke();
    ctx.fillText(y + "°", 5, py(y) - 5);
  }
  if (getSelectedBody()[2] === 301) {
    for (let [la, lo, name] of [
      [0.674, 23.473, "APOLLO 11"],
      [-3.012, -23.422, "APOLLO 12"],
      [26.132, 3.634, "APOLLO 15"],
    ]) {
      ctx.fillStyle = "#dde3ce";
      ctx.fillText("+", px(lo) - 3, py(la) + 3);
      ctx.font = "8px monospace";
      ctx.fillText(name, px(lo) + 9, py(la) - 8);
    }
  }
  let x = px(+$("lon").value),
    y = py(+$("lat").value);
  ctx.strokeStyle = "#d6f87b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#d6f87b";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 25, y);
  ctx.lineTo(x - 9, y);
  ctx.moveTo(x + 9, y);
  ctx.lineTo(x + 25, y);
  ctx.moveTo(x, y - 25);
  ctx.lineTo(x, y - 9);
  ctx.moveTo(x, y + 9);
  ctx.lineTo(x, y + 25);
  ctx.stroke();
  if (getSelectedBody()[2] !== 301) {
    ctx.fillStyle = "#b0bfa5";
    ctx.font = "12px sans-serif";
    ctx.fillText("COORDINATE GRID · NO SURFACE IMAGERY", 18, 50);
  }
  $("zoom").textContent = z.toFixed(1) + "× / Click map to select a site";
}
canvas.onclick = (e) => {
  let r = canvas.getBoundingClientRect();
  $("lon").value = (
    center[0] +
    (((e.clientX - r.left) / r.width - 0.5) * 360) / z
  ).toFixed(3);
  $("lat").value = (
    center[1] +
    ((0.5 - (e.clientY - r.top) / r.height) * 180) / z
  ).toFixed(3);
  selectedName = "Custom landing site";
  invalidateLiveResults();
  updateSelectedSite();
};
function setMapZoom(f) {
  z = Math.max(1, Math.min(8, z * f));
  center =
    z === 1
      ? [0, 0]
      : [
          Math.max(-180 + 180 / z, Math.min(180 - 180 / z, +$("lon").value)),
          Math.max(-90 + 90 / z, Math.min(90 - 90 / z, +$("lat").value)),
        ];
  renderSurfaceMap();
}
$("zin").onclick = () => setMapZoom(2);
$("zout").onclick = () => setMapZoom(0.5);
$("reset").onclick = () => {
  z = 1;
  center = [0, 0];
  renderSurfaceMap();
};
window.addEventListener("resize", renderSurfaceMap);
document.querySelectorAll("[data-site]").forEach(
  (btn) =>
    (btn.onclick = () => {
      $("body").value = "0";
      handleDestinationChange();
      let [la, lo, n] = btn.dataset.site.split(",");
      $("lat").value = la;
      $("lon").value = lo;
      selectedName = n;
      invalidateLiveResults();
      updateSelectedSite();
    }),
);
function handleDestinationChange() {
  let b = getSelectedBody();
  $("custom").hidden = !!bodies[+$("body").value][2];
  $("maptitle").textContent = b[0] + " / Surface explorer";
  $("maplabel").textContent =
    b[2] === 301 ? "LUNAR GLOBAL MOSAIC" : "PLANETARY COORDINATE GRID";
  $("credit").textContent =
    b[2] === 301
      ? "Imagery: Solar System Scope · CC BY 4.0"
      : "No global image included for this body";
  selectedName = "Custom landing site";
  invalidateLiveResults();
  calculateMissionEstimates();
  updateSelectedSite();
}
$("body").onchange = handleDestinationChange;
for (let id of [
  "lat",
  "lon",
  "alt",
  "mass",
  "isp",
  "dv",
  "date",
  "cid",
  "cr",
  "cmu",
])
  $(id).addEventListener("change", () => {
    invalidateLiveResults();
    calculateMissionEstimates();
    if (id === "lat" || id === "lon") selectedName = "Custom landing site";
    updateSelectedSite();
  });
async function analyzeSelectedSite() {
  let b;
  try {
    b = validateMissionInputs();
  } catch (e) {
    $("status").textContent = e.message;
    return;
  }
  let n = ++seq;
  last = null;
  calculateMissionEstimates();
  $("analyze").disabled = true;
  $("analyze").textContent = "Querying Horizons…";
  $("status").textContent = "Fetching Sun and Earth ephemerides…";
  try {
    const res = await fetch(
      "/api/horizons?" +
        new URLSearchParams({
          body: b[2],
          lat: $("lat").value,
          lon: $("lon").value,
          date: $("date").value,
        }),
    );
    const data = await res.json();
    if (!res.ok) throw Error(data.error || "Horizons request failed");
    if (n !== seq) return;
    last = data;
    let s = data.sun,
      e = data.earth;
    $("sun").innerHTML = s.elevation.toFixed(2) + " <small>deg</small>";
    $("sunhint").textContent =
      s.elevation > 0
        ? "Sun above geometric horizon"
        : "Sun below geometric horizon";
    $("earth").innerHTML = e.elevation.toFixed(2) + " <small>deg</small>";
    $("earthhint").textContent =
      e.elevation > 0
        ? "Earth above geometric horizon"
        : "Earth below geometric horizon";
    $("range").innerHTML =
      Math.round(e.rangeAU * 149597870.7).toLocaleString() +
      " <small>km</small>";
    $("delay").textContent =
      "One-way light time: " + (e.rangeAU * 499.00478).toFixed(2) + " s";
    $("status").innerHTML =
      '<span class="dot"></span>Horizons data retrieved · ' +
      data.epoch +
      " UTC";
  } catch (err) {
    if (n === seq) {
      $("status").textContent =
        "Live data unavailable: " +
        err.message +
        " Try another epoch or supported target.";
    }
  } finally {
    $("analyze").disabled = false;
    $("analyze").textContent = "Analyze landing site ↗";
  }
}
$("analyze").onclick = analyzeSelectedSite;
$("export").onclick = () => {
  try {
    let b = validateMissionInputs();
    let report = {
      application: "SELENE",
      flight_plan: getFlightExport(),
      planning: getPlanningExport(),
      target: b[0],
      horizons_id: b[2],
      epoch_utc: $("date").value,
      site: {
        latitude_deg: +$("lat").value,
        longitude_east_deg: +$("lon").value,
      },
      inputs: {
        mean_radius_km: b[3],
        GM_km3_s2: b[4],
        altitude_km: +$("alt").value,
        dry_mass_kg: +$("mass").value,
        isp_s: +$("isp").value,
        delta_v_ms: +$("dv").value,
      },
      estimates: calculateMissionEstimates(),
      horizons: last,
      limitations:
        "Spherical body; no terrain, local shadows, eclipse assessment, atmospheric or landing losses. Concept use only.",
    };
    let url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], {
          type: "application/json",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "selene-mission.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    $("status").textContent = e.message;
  }
};
function showInformationDialog(title, html) {
  $("ititle").textContent = title;
  $("itext").innerHTML = html;
  $("info").showModal();
}
$("guide").onclick = (e) => {
  e.preventDefault();
  showInformationDialog(
    "Plan your mission",
    "<p>Start with a mission purpose, aim, duration in Earth days, and power source. Find landing options compares three areas, then lets you explore each on the map. Aim keywords adjust resource, science, demonstration, and habitat fit. Scores are illustrative, not probability of success.</p><p>1. Choose a moon and UTC epoch. Click the map or enter east-positive longitude and latitude.</p><p>2. Set a circular orbit altitude, dry vehicle mass, engine specific impulse, and your own Δv budget.</p><p>3. Analyze to request Sun and Earth azimuth, elevation, and range from JPL Horizons. Export a JSON mission brief.</p><p>For other moons, choose a custom Horizons satellite ID and enter published mean radius and GM. Horizons support and date ranges vary by target; missing imagery is shown as a grid.</p>",
  );
};
$("sources").onclick = (e) => {
  e.preventDefault();
  showInformationDialog(
    "Data & methodology",
    '<p><a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">NASA JPL Horizons</a> supplies live observer ephemerides for the Sun and Earth, centered on your geodetic surface coordinate (0 km height). East-positive longitude, UTC; geometric horizon with no refraction. Results do not account for local topography or occultation of Earth by another body.</p><p>Lunar image: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope</a>, CC BY 4.0, global equirectangular texture. This is a visual atlas, not a calibrated terrain or hazard product. No elevation data is included.</p><p>Body constants are approximate mean-radius and gravitational-parameter values from NASA/JPL planetary satellite fact tables. Small irregular moons use a spherical approximation. Custom inputs support other Horizons-recognized moons; unavailable rotation models may prevent surface ephemerides.</p><p>g = μ/r²; v = √(μ/(r+h)); T = 2π√((r+h)³/μ). Ideal propellant = dry mass × [exp(Δv/(9.80665 × Isp)) − 1]. The entered Δv is a mission assumption, not a computed landing trajectory.</p>',
  );
};
// Render the initial calculations and selected surface coordinate.
calculateMissionEstimates();
updateSelectedSite();
