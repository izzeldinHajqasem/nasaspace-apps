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

## Lunar distance and travel-time tool

Click the airplane icon above the NASA Space Apps footer to open **Lunar route**. The tool opens the Moon's **Coordinate atlas**. Click once for A and once for B, or enter latitude/longitude directly. **Pick A** and **Pick B** replace endpoints; **Use selected landing site as A** copies the current site without changing the mission's coordinates. Enter average surface speed in km/h to estimate travel time. A dashed great-circle arc and A/B markers remain visible while measuring. Close the panel or press Escape to return to normal map selection. Clearing removes the route; mission JSON export includes a valid route under `planning.lunar_surface_route`.

`src/route-model.js` uses the haversine formula with lunar mean radius 1737.4 km. Travel time is surface distance divided by entered speed; display rounds up to minutes. `src/route.js` handles picking, typed coordinates, overlay rendering and export integration. Antipodal points have multiple equally short paths; the displayed arc uses a deterministic choice. Terrain, slopes, obstacles, rest stops and traversability are not included, and this is not spacecraft flight time. Run `node tests/route-check.mjs` for distance, time, wraparound, poles, antipodes, path sampling and invalid-input checks.

## Terrain-aware lunar routing

The airplane tool now includes **Terrain & obstacles**. Select A/B, enter a flat-ground speed and maximum allowed slope, and choose **Analyze terrain & find route**. **Zoom to A–B** makes local routes visible; atlas zoom now reaches 512×. Mark known hazards as circular exclusion zones and remove them individually. Changing slope, speed or exclusions recomputes the route locally; changing endpoints invalidates the DEM patch and requires a new analysis.

Elevation source: [LRO LOLA LDEM_128 V3.0 label](https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_128.LBL), [IMG](https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_128.IMG). Product LRO-L-LOLA-4-GDR-V1.0, producer GSFC/LOLA team, 2017-09-15 label; heights are signed little-endian 16-bit DN × 0.5 m relative to radius 1737.4 km. The global raster is 46080×23040, north to south, east-positive 0–360°, pixel registered. Its native equatorial spacing is 236.901 m; it includes interpolated elevations and can contain artifacts. It is not a boulder or fine-scale hazard map.

`src/terrain-service.mjs` validates local requests, fetches only the needed full-row byte range, verifies HTTP 206/Content-Range before decoding, and returns a bounded grid of at most 129×129 samples. `/api/lunar-terrain` supports endpoint separations up to 30 km and endpoint latitudes within ±85°. The regional patch has a 15% distance margin (minimum 1 km). Missing or unavailable data never becomes synthetic terrain. Request bands are capped at 256 raster rows to bound memory. Existing spherical measurements remain available for longer/global routes.

`src/terrain-model.js` uses an 8-neighbor A\* search minimizing modeled travel time within that patch. It blocks missing-data cells, cells whose 2D DEM gradient exceeds the selected slope, excessively steep edges, and user exclusion circles conservatively expanded by half a cell diagonal. Diagonal corner cutting is prohibited. Path distance sums segment `hypot(surface distance, elevation change)`. Profile, ascent, descent and maximum sampled path grade are shown. Endpoints use nearest-cell heights; the first/last connectors and coarse cells cannot resolve sub-cell hazards. A no-path result applies only to this grid and these constraints, not the whole Moon.

Time is **3D segment distance / flat-ground speed × (1 + 5 × absolute rise/run)**. This is an explicitly illustrative slope slowdown, not a validated rover performance model. Soil strength, traction, suspension, rocks/boulders, small craters, terrain below grid resolution, lighting and vehicle dynamics remain unresolved. A DEM route is not certified safe or globally optimal. A cyan terrain path is displayed alongside the dashed spherical baseline; a real elevation profile and all model assumptions are included in JSON export under the route's `terrain` field.

Checks: `NODE_USE_ENV_PROXY=1 node tests/terrain-check.mjs` (omit proxy setting where unnecessary). These cover synthetic flat/ramp/ridge/no-data/obstacle cases, invalid requests, range safety, raster decoding, and a live LOLA patch near Apollo 11. The application needs outbound access to `imbrium.mit.edu` for terrain requests.

## Horizons availability and fair-use handling

`src/horizons-client.mjs` follows the [JPL SSD API fair-use policy](https://ssd-api.jpl.nasa.gov/doc/): one upstream request at a time within each Worker isolate, reuse of unchanged queries, and backoff on errors. The helper serializes Sun/Earth and concurrent client requests, deduplicates identical in-flight queries, and holds up to 32 matching raw responses for 15 minutes. Cache flags and retrieval timestamps accompany results; cached results must match the exact query and are never served after expiry. This is a per-isolate optimization, not a distributed global lock.

Temporary network failures, malformed gateway responses, 429 and 500/502/503/504 receive at most three attempts with 2- and 5-second backoff (8-second fetch timeouts). After exhaustion, a 30-second cooldown prevents repeated upstream load. Long Retry-After headers create a corresponding cooldown (capped at one hour). Nonretryable HTTP errors and target/epoch errors are not repeatedly retried. Unavailable requests return HTTP 503 with Retry-After and an honest error payload; no synthetic visibility is substituted.

Find Data now makes one visibility request, using its first samples to update instantaneous Sun/Earth conditions. This avoids duplicate simultaneous queries. Starting a new analysis clears prior condition and visibility values. Failures restore Retry visibility / Retry Find Data controls, and successes include cache/retrieval provenance. Full source timestamps are included in exported visibility metadata.

Check failure/recovery paths with `node tests/horizons-resilience-check.mjs`. Live API checks remain separate and can legitimately fail during a JPL outage.
