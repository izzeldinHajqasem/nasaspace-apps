// Presentation layer for the SELINOVA reference layout. Existing planners keep
// their original controls and calculations; this file only manages navigation.
function showExplorer() {
  $("homeview").hidden = true;
  $("explorerview").hidden = false;
  requestAnimationFrame(renderSurfaceMap);
}
function showHome() {
  $("homeview").hidden = false;
  $("explorerview").hidden = true;
  location.hash = "home";
}
function openMissionTool(name) {
  showExplorer();
  $("tooldrawer").hidden = false;
  document
    .querySelectorAll(".tool-content")
    .forEach((panel) => (panel.hidden = panel.id !== "tool-" + name));
  $("drawertitle").textContent = {
    shortlist: "Landing options",
    launch: "Launch & arrival",
    budget: "Final Δv budget",
    visibility: "Sun & Earth visibility",
    conditions: "Site conditions",
  }[name];
  document
    .querySelectorAll("[data-tool]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.tool === name),
    );
}
function syncDestinationNavigation() {
  const selected = getSelectedBody();
  $("scenetitle").textContent =
    selected[0] === "Moon" ? "The Moon" : selected[0];
  document
    .querySelectorAll("[data-target]")
    .forEach((button) =>
      button.classList.toggle(
        "selected",
        +button.dataset.target === selected[2],
      ),
    );
  $("scenepins").hidden = selected[2] !== 301;
  if (selected[2] !== 301) setAtlasView(true);
}
function selectDestination(targetId) {
  const index = bodies.findIndex((body) => body[2] === +targetId);
  if (index < 0) return;
  $("body").value = String(index);
  $("body").dispatchEvent(new Event("change"));
  showExplorer();
  syncDestinationNavigation();
}
function setAtlasView(atlas) {
  $("atlasview").hidden = !atlas;
  $("sceneview").hidden = atlas;
  $("atlastab").classList.toggle("active", atlas);
  $("overviewtab").classList.toggle("active", !atlas);
  requestAnimationFrame(renderSurfaceMap);
}
for (const button of document.querySelectorAll("[data-home]"))
  button.onclick = showHome;
for (const button of document.querySelectorAll("[data-target]"))
  button.onclick = () => selectDestination(button.dataset.target);
for (const button of document.querySelectorAll("[data-tool]"))
  button.onclick = () => openMissionTool(button.dataset.tool);
for (const button of document.querySelectorAll("[data-history],[data-landing]"))
  button.onclick = () => {
    selectDestination(301);
    const [lat, lon, name] = (
      button.dataset.history || button.dataset.landing
    ).split(",");
    $("lat").value = lat;
    $("lon").value = lon;
    selectedName = name;
    invalidateLiveResults();
    updateSelectedSite();
    setAtlasView(true);
  };
$("exploremoon").onclick = () => {
  selectDestination(301);
  setAtlasView(false);
  location.hash = "explorer";
};
$("body").addEventListener("change", syncDestinationNavigation);
$("overviewtab").onclick = () => {
  if (getSelectedBody()[2] === 301) setAtlasView(false);
  else {
    $("findstatus").textContent =
      "Illustrative overview is available for the Moon. Other destinations use the coordinate atlas.";
    setAtlasView(true);
  }
};
$("atlastab").onclick = () => setAtlasView(true);
$("closedrawer").onclick = () => {
  $("tooldrawer").hidden = true;
  document
    .querySelectorAll("[data-tool]")
    .forEach((button) => button.classList.remove("active"));
};
$("toggleinspector").onclick = () => {
  const collapsed = $("explorerview").classList.toggle("inspector-collapsed");
  $("toggleinspector").textContent = collapsed ? "›" : "‹";
  $("toggleinspector").setAttribute("aria-expanded", String(!collapsed));
  requestAnimationFrame(renderSurfaceMap);
};
$("destinationsearch").oninput = () => {
  const query = $("destinationsearch").value.trim().toLowerCase();
  let count = 0;
  document.querySelectorAll("#destinationlist button").forEach((button) => {
    button.hidden = !button.textContent.toLowerCase().includes(query);
    if (!button.hidden) count++;
  });
  document.querySelectorAll("#destinationlist details").forEach((group) => {
    if (query) group.open = true;
    group.hidden = ![...group.querySelectorAll("button")].some(
      (button) => !button.hidden,
    );
  });
  $("searchstatus").textContent = count ? "" : "No matching destination.";
};
$("finddata").onclick = async () => {
  $("finddata").disabled = true;
  $("findstatus").textContent =
    "Retrieving Horizons conditions and horizon visibility…";
  try {
    // Visibility supplies both the time window and its initial site conditions.
    await $("calculatevisibility").onclick();
    $("findstatus").textContent = horizonReport
      ? "Data updated. Full report in Sun & Earth."
      : $("horizonstatus").textContent;
  } finally {
    $("finddata").textContent = horizonReport ? "Find Data" : "Retry Find Data";
    $("finddata").disabled = false;
  }
};
// Mirror live outputs without duplicating calculations or inventing preview data.
for (const output of document.querySelectorAll("[data-mirror]")) {
  const source = $(output.dataset.mirror);
  const update = () => (output.textContent = source.textContent);
  new MutationObserver(update).observe(source, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  update();
}
$("recommend").addEventListener("click", () => openMissionTool("shortlist"));
syncDestinationNavigation();
if (location.hash === "#explorer") showExplorer();
$("recommendations").addEventListener("click", (event) => {
  if (
    event.target.closest("button")?.textContent.includes("Explore this site")
  ) {
    setAtlasView(true);
    $("tooldrawer").hidden = true;
  }
});
for (const button of document.querySelectorAll("[data-site]"))
  button.addEventListener("click", () => {
    syncDestinationNavigation();
    showExplorer();
    setAtlasView(true);
  });
document.querySelector(".nav-brand").onclick = (event) => {
  event.preventDefault();
  showHome();
};
window.addEventListener("hashchange", () => {
  if (location.hash === "#home") showHome();
  else if (location.hash === "#explorer") showExplorer();
});
