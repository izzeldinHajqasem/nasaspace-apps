// Recommendation controls, Horizons sampling, ranked cards, and mission export.
let recommendationRun = 0,
  recommendationReport = null;
function staleRecommendations() {
  recommendationRun++;
  recommendationReport = null;
  $("recommendations").innerHTML = "";
  $("recstatus").textContent =
    "Brief changed. Find landing options to refresh the ranking.";
}
for (const id of [
  "purpose",
  "duration",
  "aim",
  "power",
  "body",
  "date",
  "cid",
  "cr",
  "cmu",
])
  $(id).addEventListener("change", staleRecommendations);
$("recommend").onclick = async () => {
  let b;
  try {
    b = validateMissionInputs();
    if (!$("duration").reportValidity() || !$("duration").value)
      throw Error("Enter a duration from 1 to 3650 days.");
    if (!$("aim").value.trim())
      throw Error("Describe the aim of your mission.");
  } catch (e) {
    $("recstatus").textContent = e.message;
    return;
  }
  const run = ++recommendationRun,
    days = +$("duration").value,
    purpose = $("purpose").value,
    aim = $("aim").value.trim(),
    power = $("power").value,
    epoch = $("date").value;
  const weights = objectives(purpose, aim);
  $("recommend").disabled = true;
  $("recstatus").textContent =
    "Comparing three candidate areas across the mission window…";
  $("recommendations").innerHTML = "";
  recommendationReport = null;
  try {
    let sites = candidates(b[2]);
    for (let i = 0; i < sites.length; i++) {
      if (run !== recommendationRun) return;
      let s = sites[i];
      $("recstatus").textContent =
        "Checking " + s.name + " (" + (i + 1) + "/3)…";
      try {
        let r = await fetch(
            "/api/horizons?" +
              new URLSearchParams({
                body: b[2],
                lat: s.lat,
                lon: s.lon,
                date: epoch,
                days,
              }),
          ),
          d = await r.json();
        if (!r.ok) throw Error(d.error || "Horizons unavailable");
        s.light =
          d.sun.samples.filter((v) => v.elevation > 0).length /
          d.sun.samples.length;
        s.comm =
          d.earth.samples.filter((v) => v.elevation > 0).length /
          d.earth.samples.length;
        s.samples = d.sun.samples.length;
        s.minSun = Math.min(...d.sun.samples.map((v) => v.elevation));
        s.maxSun = Math.max(...d.sun.samples.map((v) => v.elevation));
        s.horizons = d;
      } catch (e) {
        s.error =
          "Live geometry unavailable for this area; excluded from geometry ranking.";
      }
    }
    if (run !== recommendationRun) return;
    let allLive = sites.every(
      (s) => s.light !== undefined && s.comm !== undefined,
    );
    let ranked = sites
      .map((s) =>
        scoreSite(
          allLive ? s : { ...s, light: undefined, comm: undefined },
          weights,
          days,
          power,
        ),
      )
      .sort((a, b) => b.score - a.score);
    recommendationReport = {
      target: b[0],
      epoch_utc: epoch,
      duration_days: days,
      purpose,
      aim,
      power,
      ranking_mode: allLive
        ? "mission-fit-and-sampled-geometry"
        : "mission-fit-only",
      candidates: ranked,
    };
    $("recstatus").textContent = allLive
      ? "Ranked for your brief using mission fit and " +
        ranked[0].samples +
        " geometry samples per candidate."
      : "Live geometry is incomplete. All candidates ranked using the same mission-fit-only method.";
    for (let [i, s] of ranked.entries()) {
      let card = document.createElement("article");
      card.className = "recommend-card";
      let title = document.createElement("h3");
      title.textContent = i + 1 + ". " + s.name;
      card.append(title);
      let score = document.createElement("div");
      score.className = "recscore";
      score.textContent = s.score + "/100 · " + s.basis;
      card.append(score);
      let text = document.createElement("p");
      text.textContent = s.note;
      card.append(text);
      let detail = document.createElement("p");
      detail.className = "tiny";
      detail.textContent =
        s.lat +
        "° N, " +
        s.lon +
        "° E · Mission fit " +
        s.scienceFit +
        "/100" +
        (s.horizons
          ? " · Sun above horizon " +
            Math.round(
              (s.horizons.sun.samples.filter((v) => v.elevation > 0).length /
                s.samples) *
                100,
            ) +
            "% · Earth above horizon " +
            Math.round(
              (s.horizons.earth.samples.filter((v) => v.elevation > 0).length /
                s.horizons.earth.samples.length) *
                100,
            ) +
            "% of samples."
          : " · Geometry unavailable.");
      card.append(detail);
      let btn = document.createElement("button");
      btn.className = "btn outline";
      btn.textContent = "Explore this site ↗";
      btn.onclick = () => {
        $("lat").value = s.lat;
        $("lon").value = s.lon;
        selectedName = s.name;
        invalidateLiveResults();
        updateSelectedSite();
        $("reset").click();
        $("map").scrollIntoView({ behavior: "smooth", block: "center" });
        analyzeSelectedSite();
      };
      card.append(btn);
      $("recommendations").append(card);
    }
  } finally {
    $("recommend").disabled = false;
  }
};
const originalExport = $("export").onclick;
$("export").onclick = () => {
  if (!recommendationReport) {
    originalExport();
    return;
  }
  let report = {
    ...recommendationReport,
    limitations:
      "Ranked shortlist, not a global optimum. Heuristic science fit; 25 time samples can miss nights, eclipses and communication gaps. No terrain, hazards, weather, radiation, atmospheric entry, or trajectory validation.",
  };
  let url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  let a = document.createElement("a");
  a.href = url;
  a.download = "selene-landing-options.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
