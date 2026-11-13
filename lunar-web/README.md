# Lunar Navigator website

FastAPI + Plotly natural-satellite explorer powered by JPL Horizons.

## Run locally

From this directory:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://localhost:8000 for the interactive website or http://localhost:8000/docs for the API.

## Render

The repository root's `render.yaml` configures this directory as a Docker service. In Render choose **New > Blueprint** and connect this repository. This only configures deployment; it doesn't deploy automatically just by pushing code.

A live network connection to Horizons is required. This is a scientific demo, not flight-qualified navigation software.

## NASA Space Apps 2026: Lunar Landing Site Navigator

The **/landing** page is a mission-window explorer for prospective lunar south-pole sites.
Pick two coordinates and a UTC date, then inspect sampled Sun/Earth elevation
from **JPL Horizons** for a stationary observer on the Moon.

**Endpoints:** `GET /api/landing/visibility?lat=-89.5&lon=0&start=2026-11-14T00:00:00Z&hours=48&step_minutes=60`

The response includes sampled azimuth/elevation (degrees), hours the Sun and
Earth appear above a **smooth** lunar horizon, and hours both are visible.
Data can be exported to CSV in the browser. The sample location presets are
illustrative and are NOT verified NASA landing candidates.

### Scope / limits
- Terrain-aware horizon, LOLA/DEM elevation, crater shadowing and slopes
  **are not yet implemented**; NASA Moon Trek is linked for qualitative inspection.
- Earth line-of-sight is only geometric: it is not a communication link budget
  or a guarantee of communications availability.
- Smooth-horizon solar geometry is not a prediction of solar power availability.
- Results require a live connection to JPL Horizons and may be rate-limited.
- Not flight-qualified, not a validated landing-site safety product.

### Testing the planner

Run the FastAPI app (from `lunar-web`) and open `http://localhost:8000/landing`.
Select the date and compare candidate A and B. Open `/docs` to test the new API.

### Lunar surface map

The `/surface` page embeds [NASA Moon Trek](https://trek.nasa.gov/moon/) in place of LROC QuickMap. Use the **3D Globe** or **South Pole Map** projection inside Moon Trek. An **Open NASA Moon Trek** link is provided because the external site may block iframe embedding. Apollo markers remain on the separately rendered demonstration globe.
