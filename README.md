# Lunar Navigation Backend

A small FastAPI backend that retrieves natural-satellite ephemerides from JPL
Horizons through Astroquery and returns frontend-friendly JSON.

## 1. Setup

Python 3.10+ recommended.

```bash
python -m venv .venv
```

Activate it:

**Windows**
```bash
.venv\Scripts\activate
```

**macOS / Linux**
```bash
source .venv/bin/activate
```

Install packages and start the API:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` for interactive API documentation.

## 2. Endpoints

- `GET /api/bodies` — available natural satellites and their parent bodies.
- `GET /api/ephemeris/moon` — one state vector for the current time.
- `GET /api/ephemeris/europa?epoch=2026-11-13T12:00:00` — state vector at a chosen epoch.
- `GET /api/trajectory/moon?start=2026-11-13&stop=2026-11-14&step=1h` — time series for plotting.
- `GET /api/orbit/titan` — osculating orbital elements.

Supported keys: `moon`, `phobos`, `deimos`, `io`, `europa`, `ganymede`,
`callisto`, `enceladus`, `titan`, `triton`.

## 3. Example frontend request

```javascript
const response = await fetch("http://127.0.0.1:8000/api/ephemeris/moon");
const state = await response.json();

console.log(state.position);
console.log(state.velocity);
```

For a Three.js trajectory, call `/api/trajectory/moon?...` and map each
`position_km` point to a `THREE.Vector3`.

## 4. Coordinate and engineering notes

- State vectors are returned relative to the selected moon's parent-body center.
- Position is converted from AU to km; velocity from AU/day to km/s.
- The `refplane="earth"` setting requests the equatorial reference plane.
- Distances and speeds are derived from the returned state vector.
- The orbital-elements endpoint returns Horizons osculating elements relative
  to the selected parent-body center.
- Horizons output is ephemeris/reference data, not live spacecraft telemetry.
  It does not determine a lander's or rover's position.
- This is a research/demo backend, not flight-qualified navigation software.
  Operational navigation needs spacecraft observations, an estimator,
  uncertainty handling, validated frames/time systems, and mission-specific
  dynamics.

## 5. Deployment

Before public deployment:
- Replace the localhost CORS origins with your actual frontend domain.
- Add request limits, caching, logging, and monitoring.
- Avoid sending very large trajectory requests.
- Pin tested dependency versions for reproducible deployments.
