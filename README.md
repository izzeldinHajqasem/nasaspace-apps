# SELENE — Lunar Landing Site Navigator

The source of the SELENE website built in this conversation, including the mission brief, interactive lunar atlas, JPL Horizons proxy, mission calculations, ranked landing-area shortlist, and JSON export.

SELENE is the sole application in this repository. Run the commands below from the repository root.

## Build and run

Requires Python 3, curl, and Node.js 22+ (Node.js 24 recommended).

```sh
python3 build.py
node serve.mjs
```

Open http://localhost:3000. The first build downloads a lunar texture from Solar System Scope into `.cache/`; subsequent builds reuse it. Network access to NASA JPL Horizons is required for live analysis. On hosts requiring a configured HTTP proxy, use `NODE_USE_ENV_PROXY=1` with Node.js 24.

## Verify

```sh
node tests/check.mjs
node tests/recommend-check.mjs
```

The checks include live Horizons requests. Use `NODE_USE_ENV_PROXY=1 node ...` where required by your environment.

## Deploy

The generated file `dist/server/index.mjs` is a Cloudflare Worker with a default `fetch` handler. Use the included `wrangler.toml` with your own Cloudflare account, for example `npx wrangler deploy` after building. No API keys or original Sites account identifiers are required. Local preview uses the same handler via `serve.mjs`.

## Recommendation method and limits

Purpose and aim keyword rules weight resource, science, demonstration, and habitat fit. A three-area shortlist uses curated illustrative fit scores for the Moon, Mars, Europa, Enceladus, and Titan; other targets receive labeled exploratory reference coordinates. Solar/independent power and mission duration affect the weighting of sampled illumination. JPL Horizons supplies Sun and Earth geometry at 25 times across the mission duration. If any candidate lacks geometry, all candidates use mission-fit-only scores.

These are preliminary comparisons among three areas, not a global optimization or certified safe landing locations. Sampled percentages cannot guarantee continuous power or communications and may miss eclipses, nights, and gaps. No calibrated elevation, terrain hazards, atmosphere/entry dynamics, radiation, weather, or trajectory solver is included. Horizons surface support and ephemeris coverage vary by target. Gas giants are excluded.

## Data and attribution

- NASA/JPL Horizons: https://ssd.jpl.nasa.gov/horizons/ (UTC, east-positive longitude, geodetic surface observer at 0 km, airless apparent coordinates).
- Lunar texture: Solar System Scope, https://www.solarsystemscope.com/textures/ , CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ . Shown as an interactive equirectangular visual atlas with grid and markers; not a calibrated hazard map.
- Approximate physical constants: NASA/JPL planetary satellite fact tables. Custom targets require a valid Horizons ID, mean radius, and GM.

Not affiliated with NASA. No software license is assigned by this export; the texture retains its stated license.

## Source layout

- `src/index.html`: page structure and input controls.
- `src/styles.css`: layout, typography, colors, and responsive rules.
- `src/app.js`: destination data, interactive map, physical estimates, and single-site analysis.
- `src/mission-model.js`: shared candidate data, mission-fit rules, and scoring.
- `src/recommendations.js`: recommendation controls, live sampling, ranked cards, and export.
- `src/worker.template.mjs`: HTTP routes and NASA JPL Horizons requests/parsing.
- `build.py`: bundles the page assets and lunar texture into one deployable Worker.
- `serve.mjs`: local Node HTTP adapter for the Worker.
- `tests/`: calculation/API checks and recommendation scoring checks.

The build embeds CSS and scripts for deployment; edit the readable source files instead of generated `dist/` files. The scripts load in order because recommendation controls reuse the map and mission helpers.

Format the JavaScript, HTML, CSS, and Markdown with `npx --yes prettier@3.6.2 --write src/ serve.mjs tests/ README.md`.

## Launch and arrival planner

`src/flight-model.js` contains the pure timeline model; `src/flight.js` connects it to the page. Check it with `node tests/flight-check.mjs`.

Choose an Earth launch pad or custom coordinates, UTC departure, and transfer model. The ideal lunar estimate uses `π√(a³/μEarth)`, with `a = (Earth radius + parking altitude + assumed Earth–Moon distance)/2`. This is an Earth-centered half-ellipse time to the assumed lunar distance, not a solved lunar rendezvous. Other destinations accept a supplied cruise duration. Pad coordinates do not change travel time; the displayed eastward rotation speed is context only.

Total time adds the entered ascent-to-parking duration, cruise estimate, and a constant-speed terminal descent (`height/downward speed`). Descent angle is `atan2(downward speed, horizontal speed)`, measured below the local horizontal (90° is vertical). These entered speeds are not predictions of touchdown speed. Surface escape speed uses `√(2GM/r)` for the selected destination.

The model omits alignment, Moon motion, staging/coast delays, capture, inclination/plane changes, atmosphere, terrain and powered landing dynamics. The terminal descent model is independent of the transfer orbit. The “Use touchdown as mission epoch” button aligns Horizons analysis and the recommendation window to the estimated arrival, rounded down to the minute. JSON export includes inputs, estimates and caveats.

## Final Δv budget and horizon visibility

`src/planning-model.js` contains pure budget and horizon-integration functions. `src/planning.js` connects them to the page. Run `NODE_USE_ENV_PROXY=1 node tests/planning-check.mjs` for budget, crossing, and live visibility checks (omit the proxy setting where unnecessary).

The editable budget starts with a one-way lunar example **from low Earth parking orbit**: 3150 m/s departure, 50 corrections, 900 lunar capture, and 1900 landing. Its 6000 m/s subtotal plus 15% reserve gives 6900 m/s across the entered vehicles. Earth launch and return default to zero and must be entered if required. Values are illustrative and do not automatically adapt to other destinations. The calculator sums entered requirements; it does not solve maneuvers. Only one vehicle's allocation is copied into the existing single-vehicle propellant calculation, with a reminder to set that vehicle's mass and Isp. Actual stage design requires a changing-mass/burn sequence model.

The visibility report uses `/api/horizons?detail=1` for the selected target, surface coordinate, epoch and a separate 1–60 Earth-day window. Sampling is every 15 minutes for windows up to seven days, hourly otherwise. It linearly interpolates zero-elevation crossings and integrates time above the horizon, providing next sunset, sunrise, Earthset, Earthrise, total sunlight hours, longest estimated sunlit interval within the window, and time-weighted Earth visibility. Timeline bands and JSON export carry the same report. Changes to target, site, epoch or window invalidate old results.

All visibility uses the apparent airless Sun/Earth **center** elevation above 0°, not terrain or disk-limb contact. Time estimates have sample-scale uncertainty and may miss events between samples. No refraction, local terrain shadows, eclipses, occultation by another body, antenna constraints or communication link budget is modeled. A missing crossing means none was detected in the requested window, not that a body never sets. These percentages describe geometric elevation, not guaranteed solar power or a usable Earth link.

## SELINOVA interface

The visual layout follows the user-provided `SELINOVA.pdf`: an Earth home screen, navy destination navigation, a left mission inspector, a lunar overview, and separate mission-tool drawers. `src/interface.js` manages view switching, destination search, historical-site navigation, the collapsible inspector and live readout mirrors.

`src/assets/earth-home.jpg` and `src/assets/lunar-overview.jpg` are unmodified raster images extracted from that supplied design reference. Their original licensing is not specified by this repository; no new license is asserted. They are presentation assets. The perspective overview and its schematic pins are not a georeferenced terrain model. The separate **Coordinate atlas** retains the original map and coordinate calculations.

The build embeds these two images into the Worker and serves them under `/assets/`. Budget, transfer, recommendation, Horizons, visibility and JSON-export calculations retain their existing behavior. Use **Find Data** to request single-site conditions and the horizon-window report together; detailed tools are available in the bottom toolbar.
