// Mission-fit scoring and candidate recommendations.
// These illustrative rankings do not establish landing safety or global optimality.
// Each candidate: label, latitude, east-positive longitude, fit weights, caveat.
// Fit order: resources, science, technology demonstration, habitat.
const catalogue = {
  301: [
    [
      "Shackleton rim region",
      -89.5,
      0,
      [1, 0.55, 0.9, 0.8],
      "Polar volatile science; rugged terrain and local shadow require high-resolution validation.",
    ],
    [
      "Oceanus Procellarum",
      18,
      -57,
      [0.2, 0.9, 0.65, 0.75],
      "Basaltic plains support volcanic and geologic investigations; local hazards unassessed.",
    ],
    [
      "Mare Tranquillitatis",
      0.674,
      23.473,
      [0.15, 0.75, 0.95, 0.6],
      "Historic landing region for technology demonstrations; lunar night requires power storage.",
    ],
  ],
  499: [
    [
      "Jezero crater",
      18.38,
      77.58,
      [0.45, 1, 0.65, 0.7],
      "Ancient delta deposits make a compelling past-habitability target; planetary protection applies.",
    ],
    [
      "Elysium Planitia",
      4.5,
      135.9,
      [0.3, 0.6, 0.95, 0.6],
      "Broad plains suit geophysics and technology demonstrations; landing hazards still require mapping.",
    ],
    [
      "Arcadia Planitia",
      40,
      -170,
      [1, 0.7, 0.65, 0.85],
      "Midlatitude subsurface ice is a resource-science motivation; ice access is unverified at this coordinate.",
    ],
  ],
  502: [
    [
      "Leading-hemisphere ice",
      0,
      90,
      [0.8, 0.9, 0.4, 0.7],
      "Icy surface science; severe radiation, contamination control, and unresolved landing hazards.",
    ],
    [
      "Equatorial trailing hemisphere",
      0,
      -90,
      [0.65, 0.85, 0.35, 0.65],
      "Surface chemistry target; severe radiation environment and unknown terrain.",
    ],
    [
      "High-latitude ice",
      60,
      0,
      [0.8, 0.8, 0.3, 0.6],
      "Compare latitude-dependent ice processes; no validated landing terrain.",
    ],
  ],
  602: [
    [
      "South polar terrain",
      -80,
      0,
      [1, 1, 0.3, 0.6],
      "Plume-related ice science; active terrain and planetary protection need dedicated assessment.",
    ],
    [
      "Equatorial ice",
      0,
      60,
      [0.65, 0.7, 0.55, 0.6],
      "Comparative ice geology; no calibrated landing hazards included.",
    ],
    [
      "Northern terrain",
      60,
      0,
      [0.6, 0.65, 0.5, 0.55],
      "Regional ice comparison; surface properties remain poorly constrained.",
    ],
  ],
  606: [
    [
      "Shangri-La region",
      -10,
      164,
      [0.5, 0.85, 0.65, 0.6],
      "Dune and organic chemistry science; dense atmosphere needs an entry/descent model.",
    ],
    [
      "Equatorial terrain",
      0,
      30,
      [0.45, 0.75, 0.6, 0.6],
      "Organic surface science; no landing suitability or weather assessment.",
    ],
    [
      "Northern lake region",
      75,
      100,
      [0.8, 1, 0.25, 0.7],
      "Methane-cycle science; liquid-surface landing requires a specialized vehicle.",
    ],
  ],
};
function objectives(purpose, aim) {
  const t = aim.toLowerCase();
  let w = {
    resources: [1, 0.2, 0.2, 0.8],
    science: [0.3, 1, 0.3, 0.4],
    technology: [0.1, 0.3, 1, 0.3],
    habitat: [0.8, 0.3, 0.7, 1],
  }[purpose].slice();
  if (/ice|water|resource|fuel/.test(t)) w[0] += 1;
  if (/life|geolog|sample|science|bio|crater/.test(t)) w[1] += 1;
  if (/test|robot|rover|demo|instrument/.test(t)) w[2] += 1;
  if (/base|habitat|crew|settle|long.term/.test(t)) w[3] += 1;
  return w;
}
function candidates(id) {
  return (
    catalogue[id] || [
      [
        "Equatorial reference area",
        0,
        0,
        [0.5, 0.5, 0.5, 0.5],
        "Exploratory coordinate only; no geology or terrain suitability evidence.",
      ],
      [
        "Midlatitude reference area",
        35,
        90,
        [0.5, 0.5, 0.5, 0.5],
        "Exploratory coordinate only; compare lighting and Earth visibility.",
      ],
      [
        "High-latitude reference area",
        70,
        -90,
        [0.5, 0.5, 0.5, 0.5],
        "Exploratory coordinate only; no resource or safety inference.",
      ],
    ]
  ).map(([name, lat, lon, fit, note]) => ({
    name,
    lat,
    lon,
    fit,
    note,
    curated: !!catalogue[id],
  }));
}
// Blend illustrative mission fit with sampled lighting and Earth visibility.
// Missing geometry uses fit-only scores for the complete shortlist.
function scoreSite(site, weights, days, power) {
  const science =
    site.fit.reduce((s, v, i) => s + v * weights[i], 0) /
    weights.reduce((s, v) => s + v, 0);
  const lightWeight = power === "solar" ? (days > 14 ? 0.4 : 0.3) : 0.1,
    commWeight = 0.15;
  let available = site.light !== undefined && site.comm !== undefined;
  return {
    ...site,
    score: available
      ? Math.round(
          100 *
            ((1 - lightWeight - commWeight) * science +
              lightWeight * site.light +
              commWeight * site.comm),
        )
      : Math.round(science * 100),
    basis: available
      ? "Mission fit + sampled Horizons geometry"
      : "Mission-fit heuristic only",
    scienceFit: Math.round(science * 100),
  };
}
