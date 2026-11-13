"""JPL Horizons access layer, using Astroquery rather than hand-parsing HTTP."""
from datetime import datetime, timezone
from astropy.time import Time
from astroquery.jplhorizons import Horizons

from .catalog import BODIES
from .calculations import vector_to_km, vector_to_km_s, derive_state

def _body_or_raise(body_key: str):
    body = BODIES.get(body_key.lower())
    if body is None:
        raise KeyError(body_key)
    return body

def _epoch_jd(epoch: str | None):
    # Horizons expects an epoch; Astroquery accepts a Julian Date.
    instant = Time(epoch) if epoch else Time(datetime.now(timezone.utc))
    return instant, float(instant.tdb.jd)

def _float(table, column, index=0):
    return float(table[column][index])

def get_state(body_key: str, epoch: str | None = None):
    body = _body_or_raise(body_key)
    instant, jd = _epoch_jd(epoch)

    query = Horizons(
        id=body["id"],
        location=body["center"],
        epochs=jd,
    )
    # "earth" selects the equatorial reference plane for vector output.
    vectors = query.vectors(refplane="earth")

    position_au = [_float(vectors, axis) for axis in ("x", "y", "z")]
    velocity_au_day = [_float(vectors, axis) for axis in ("vx", "vy", "vz")]

    position_km = vector_to_km(position_au)
    velocity_km_s = vector_to_km_s(velocity_au_day)
    derived = derive_state(position_km, velocity_km_s)

    return {
        "body": body_key.lower(),
        "name": body["name"],
        "parent": body["parent"],
        "epoch_utc": instant.utc.isot,
        "julian_date_tdb": jd,
        "frame": "Horizons equatorial reference plane (ICRF-aligned)",
        "origin": f"{body['parent']} center",
        "units": {"position": "km", "velocity": "km/s"},
        "position": dict(zip(("x", "y", "z"), position_km)),
        "velocity": dict(zip(("vx", "vy", "vz"), velocity_km_s)),
        **derived,
        "source": "NASA/JPL Horizons via Astroquery",
    }

def get_trajectory(body_key: str, start: str, stop: str, step: str = "10m"):
    body = _body_or_raise(body_key)
    start_time = Time(start)
    stop_time = Time(stop)
    if stop_time.jd <= start_time.jd:
        raise ValueError("'stop' must be later than 'start'")

    query = Horizons(
        id=body["id"],
        location=body["center"],
        epochs={
            "start": start_time.utc.isot,
            "stop": stop_time.utc.isot,
            "step": step,
        },
    )
    vectors = query.vectors(refplane="earth")

    points = []
    for i in range(len(vectors)):
        position = vector_to_km([_float(vectors, axis, i) for axis in ("x", "y", "z")])
        velocity = vector_to_km_s([_float(vectors, axis, i) for axis in ("vx", "vy", "vz")])
        points.append({
            "epoch_jd_tdb": _float(vectors, "datetime_jd", i),
            "position_km": dict(zip(("x", "y", "z"), position)),
            "velocity_km_s": dict(zip(("vx", "vy", "vz"), velocity)),
            **derive_state(position, velocity),
        })

    return {
        "body": body_key.lower(),
        "name": body["name"],
        "parent": body["parent"],
        "origin": f"{body['parent']} center",
        "frame": "Horizons equatorial reference plane (ICRF-aligned)",
        "units": {"position": "km", "velocity": "km/s"},
        "step": step,
        "points": points,
        "source": "NASA/JPL Horizons via Astroquery",
    }

def get_orbital_elements(body_key: str, epoch: str | None = None):
    body = _body_or_raise(body_key)
    instant, jd = _epoch_jd(epoch)

    query = Horizons(
        id=body["id"],
        location=body["center"],
        epochs=jd,
    )
    elements = query.elements(refplane="earth")
    row = elements[0]

    # These are osculating elements relative to the selected parent-body center.
    fields = ("e", "incl", "Omega", "w", "a", "q", "Q", "P", "M", "nu")
    values = {}
    for field in fields:
        if field in elements.colnames:
            try:
                values[field] = float(row[field])
            except (TypeError, ValueError):
                values[field] = None

    return {
        "body": body_key.lower(),
        "name": body["name"],
        "parent": body["parent"],
        "epoch_utc": instant.utc.isot,
        "elements": values,
        "note": "Osculating orbital elements from Horizons; units follow the field definitions.",
        "source": "NASA/JPL Horizons via Astroquery",
    }
