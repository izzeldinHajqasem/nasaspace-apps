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
