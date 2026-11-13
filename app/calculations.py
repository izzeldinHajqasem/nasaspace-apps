"""Unit conversions and derived quantities for Horizons state vectors."""
import math

AU_KM = 149_597_870.7
SECONDS_PER_DAY = 86_400.0

def vector_to_km(values):
    return [float(v) * AU_KM for v in values]

def vector_to_km_s(values):
    return [float(v) * AU_KM / SECONDS_PER_DAY for v in values]

def norm(vector):
    return math.sqrt(sum(component * component for component in vector))

def derive_state(position_km, velocity_km_s):
    distance_km = norm(position_km)
    speed_km_s = norm(velocity_km_s)

    # Positive means moving away from the parent-body origin.
    radial_speed_km_s = (
        sum(p * v for p, v in zip(position_km, velocity_km_s)) / distance_km
        if distance_km > 0 else 0.0
    )

    return {
        "distance_km": distance_km,
        "speed_km_s": speed_km_s,
        "radial_speed_km_s": radial_speed_km_s,
    }
