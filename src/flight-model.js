// Concept-level timeline, not a launch-window, rendezvous, or trajectory solver.
const EARTH_RADIUS_KM = 6378.137;
const EARTH_GM_KM3_S2 = 398600.4418;
const EARTH_ROTATION_RAD_S = 7.292115e-5;

function calculateFlightPlan(input) {
  const positive = (value, label, allowZero = false) => {
    if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
      throw Error(
        label + " must be " + (allowZero ? "nonnegative." : "positive."),
      );
    }
  };
  const departure = new Date(input.departureUtc + "Z");
  if (!Number.isFinite(+departure))
    throw Error("Enter a valid UTC launch time.");
  if (
    !Number.isFinite(input.launchLatitude) ||
    Math.abs(input.launchLatitude) > 90 ||
    !Number.isFinite(input.launchLongitude) ||
    Math.abs(input.launchLongitude) > 180
  ) {
    throw Error("Enter valid Earth launch coordinates.");
  }
  positive(input.targetRadiusKm, "Destination radius");
  positive(input.targetGm, "Destination GM");
  positive(input.ascentMinutes, "Ascent time", true);
  positive(input.descentHeightKm, "Descent start height");
  positive(input.downwardSpeedMs, "Downward descent speed");
  positive(input.horizontalSpeedMs, "Horizontal descent speed", true);

  let cruiseSeconds;
  let injectionSpeedKms = null;
  if (input.mode === "lunar") {
    if (input.targetId !== 301)
      throw Error(
        "Ideal lunar transfer is available only for the Moon. Choose a supplied cruise duration for other destinations.",
      );
    positive(input.parkingAltitudeKm, "Earth parking altitude", true);
    const departureRadius = EARTH_RADIUS_KM + input.parkingAltitudeKm;
    if (
      !Number.isFinite(input.lunarDistanceKm) ||
      input.lunarDistanceKm <= departureRadius
    ) {
      throw Error(
        "Earth–Moon center distance must exceed the parking orbit radius.",
      );
    }
    // Half the period of an Earth-centered ellipse: perigee at parking orbit,
    // apogee at the assumed lunar center distance. Lunar gravity is omitted.
    const semiMajorAxis = (departureRadius + input.lunarDistanceKm) / 2;
    cruiseSeconds = Math.PI * Math.sqrt(semiMajorAxis ** 3 / EARTH_GM_KM3_S2);
    injectionSpeedKms = Math.sqrt(
      EARTH_GM_KM3_S2 * (2 / departureRadius - 1 / semiMajorAxis),
    );
  } else {
    positive(input.manualCruiseDays, "Cruise duration");
    cruiseSeconds = input.manualCruiseDays * 86400;
  }
  // Independent, constant-speed terminal descent assumption. It does not join
  // the transfer orbit dynamically and is not a predicted touchdown velocity.
  const descentSeconds = (input.descentHeightKm * 1000) / input.downwardSpeedMs;
  const approachAngleDeg =
    (Math.atan2(input.downwardSpeedMs, input.horizontalSpeedMs) * 180) /
    Math.PI;
  const totalSeconds =
    input.ascentMinutes * 60 + cruiseSeconds + descentSeconds;
  const arrival = new Date(+departure + totalSeconds * 1000);
  if (!Number.isFinite(+arrival))
    throw Error("Timeline exceeds the supported date range.");
  return {
    launch: {
      name: input.launchName,
      latitude_deg: input.launchLatitude,
      longitude_east_deg: input.launchLongitude,
      body: "Earth",
      departure_utc: departure.toISOString(),
    },
    target_id: input.targetId,
    mode: input.mode,
    inputs: { ...input },
    cruise_seconds: cruiseSeconds,
    ascent_seconds: input.ascentMinutes * 60,
    descent_seconds: descentSeconds,
    total_seconds: totalSeconds,
    estimated_touchdown_utc: arrival.toISOString(),
    approach_angle_below_horizontal_deg: approachAngleDeg,
    descent_ground_distance_km:
      (input.horizontalSpeedMs * descentSeconds) / 1000,
    destination_surface_escape_kms: Math.sqrt(
      (2 * input.targetGm) / input.targetRadiusKm,
    ),
    earth_surface_escape_kms: Math.sqrt(
      (2 * EARTH_GM_KM3_S2) / EARTH_RADIUS_KM,
    ),
    earth_rotation_eastward_speed_ms:
      EARTH_ROTATION_RAD_S *
      EARTH_RADIUS_KM *
      1000 *
      Math.cos((input.launchLatitude * Math.PI) / 180),
    ideal_injection_speed_kms: injectionSpeedKms,
    limitations:
      "Illustrative timing only. Launch coordinates do not alter flight time. No launch-window alignment, Moon motion, plane changes, ascent trajectory, lunar capture, staging/coast delays, powered landing trajectory, atmosphere or terrain. Constant descent speeds are assumptions, not touchdown predictions.",
  };
}
