"""NASA Space Apps 2026: lunar south-pole Sun/Earth visibility.

Geometric, smooth-horizon estimates only. Does not use LOLA terrain.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import math

from astroquery.jplhorizons import Horizons
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()


def _utc_time(value: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="start must be ISO 8601 UTC time") from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(second=0, microsecond=0)


def _number(value):
    try:
        v = float(value)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


@lru_cache(maxsize=128)
def _horizons_altaz(target: str, lat: float, lon: float, start: str, stop: str, step: int):
    """Sample azimuth/elevation of a body at a Moon-fixed topocentric site.

    For ephemerides, Horizons range epochs are UTC. For the Moon, east
    longitude is positive, as in the geographic landing-site coordinates.
    """
    loc = {"lon": lon, "lat": lat, "elevation": 0.0, "body": 301}
    eph = Horizons(
        id=target,
        location=loc,
        epochs={"start": start, "stop": stop, "step": f"{step}m"},
    ).ephemerides(quantities="4")
    points = []
    for row in eph:
        points.append({
            "jd_utc": float(row["datetime_jd"]),
            "azimuth_deg": _number(row["AZ"]),
            "elevation_deg": _number(row["EL"]),
        })
    return points


def _duration(points: list[dict], field: str) -> float | None:
    """Positive-altitude duration via linear interpolation between samples."""
    if not points:
        return None
    seconds = 0.0
    for a, b in zip(points, points[1:]):
        x, y = a[field], b[field]
        if x is None or y is None:
            return None
        dt = (b["jd_utc"] - a["jd_utc"]) * 86400
        if dt <= 0:
            continue
        if x > 0 and y > 0:
            portion = 1.0
        elif x <= 0 and y <= 0:
            portion = 0.0
        elif x > 0:
            portion = x / (x - y)
        else:
            portion = y / (y - x)
        seconds += dt * portion
    return round(seconds / 3600, 2)


def _joint_duration(points: list[dict]) -> float | None:
    """Approximate duration when Sun AND Earth elevations are positive."""
    seconds = 0.0
    for a, b in zip(points, points[1:]):
        values = [a["sun_elevation_deg"], b["sun_elevation_deg"],
                  a["earth_elevation_deg"], b["earth_elevation_deg"]]
        if any(x is None for x in values):
            return None
        s0, s1, e0, e1 = values
        cuts = [0.0, 1.0]
        for u, v in ((s0, s1), (e0, e1)):
            if (u > 0) != (v > 0) and u != v:
                cuts.append(max(0.0, min(1.0, u / (u - v))))
        cuts = sorted(set(cuts))
        dt = (b["jd_utc"] - a["jd_utc"]) * 86400
        for left, right in zip(cuts, cuts[1:]):
            mid = (left + right) / 2
            if s0 + (s1 - s0) * mid > 0 and e0 + (e1 - e0) * mid > 0:
                seconds += dt * (right - left)
    return round(seconds / 3600, 2)


@router.get("/api/landing/visibility")
def landing_visibility(
    lat: float = Query(..., ge=-90, le=90, description="Latitude, north positive"),
    lon: float = Query(..., ge=-180, le=180, description="East-positive longitude"),
    start: str = Query(..., description="UTC timestamp in ISO 8601 format"),
    hours: int = Query(48, ge=6, le=168),
    step_minutes: int = Query(60, ge=30, le=720),
):
    """Compare smooth-horizon Sun illumination and Earth line-of-sight geometry."""
    if hours * 60 / step_minutes > 169:
        raise HTTPException(status_code=400, detail="Maximum 170 samples per target")
    begin = _utc_time(start)
    end = begin + timedelta(hours=hours)
    a = begin.strftime("%Y-%m-%d %H:%M")
    b = end.strftime("%Y-%m-%d %H:%M")
    # Precision beyond 0.00001 degree is not meaningful for this model.
    lat, lon = round(lat, 5), round(lon, 5)
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            future_sun = pool.submit(_horizons_altaz, "10", lat, lon, a, b, step_minutes)
            future_earth = pool.submit(_horizons_altaz, "399", lat, lon, a, b, step_minutes)
            sun = future_sun.result()
            earth = future_earth.result()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="JPL Horizons could not return Sun/Earth ephemerides for this request",
        ) from exc

    if not sun or len(sun) != len(earth):
        raise HTTPException(status_code=502, detail="Incomplete Horizons sampling")

    points = []
    for s, e in zip(sun, earth):
        if abs(s["jd_utc"] - e["jd_utc"]) > 1e-7:
            raise HTTPException(status_code=502, detail="Horizons epoch mismatch")
        ts = datetime.fromtimestamp(
            (s["jd_utc"] - 2440587.5) * 86400, tz=timezone.utc
        ).isoformat(timespec="minutes").replace("+00:00", "Z")
        points.append({
            "time_utc": ts,
            "jd_utc": s["jd_utc"],
            "sun_azimuth_deg": s["azimuth_deg"],
            "sun_elevation_deg": s["elevation_deg"],
            "earth_azimuth_deg": e["azimuth_deg"],
            "earth_elevation_deg": e["elevation_deg"],
            "sun_above_horizon": (s["elevation_deg"] > 0) if s["elevation_deg"] is not None else None,
            "earth_above_horizon": (e["elevation_deg"] > 0) if e["elevation_deg"] is not None else None,
        })
    sun_hours = _duration(points, "sun_elevation_deg")
    earth_hours = _duration(points, "earth_elevation_deg")
    both_hours = _joint_duration(points)
    return {
        "site": {"lat": lat, "lon": lon, "elevation_km": 0},
        "start_utc": begin.isoformat().replace("+00:00", "Z"),
        "end_utc": end.isoformat().replace("+00:00", "Z"),
        "sampling_minutes": step_minutes,
        "summary": {
            "sun_above_smooth_horizon_hours": sun_hours,
            "earth_above_smooth_horizon_hours": earth_hours,
            "both_above_smooth_horizon_hours": both_hours,
            "window_hours": hours,
        },
        "points": points,
        "source": "NASA/JPL Horizons via astroquery; topocentric lunar observer",
        "limitations": [
            "Geometric smooth-ellipsoid horizon only; terrain relief, crater shadowing, and LOLA horizon masks are NOT applied.",
            "Sun elevation > 0 does not equal usable solar electricity or continuous daylight at a tilted panel.",
            "Earth elevation > 0 is not a guaranteed radio link; antenna mask, link budget, topography and relay geometry are excluded.",
            "Durations approximate threshold crossings by linear interpolation between samples; smaller steps improve temporal resolution.",
            "This is not landing-site safety certification or operational flight software.",
        ],
    }
