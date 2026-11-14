// Shortest surface distances on a sphere with the Moon's mean radius.
const LUNAR_MEAN_RADIUS_KM = 1737.4;
function validateLunarPoint(point) {
  if (
    !point ||
    !Number.isFinite(point.lat) ||
    Math.abs(point.lat) > 90 ||
    !Number.isFinite(point.lon) ||
    Math.abs(point.lon) > 180
  ) {
    throw Error(
      "Enter latitude from −90 to 90° and longitude from −180 to 180°.",
    );
  }
  return point;
}
function calculateLunarRoute(start, end, speedKmh) {
  validateLunarPoint(start);
  validateLunarPoint(end);
  if (!Number.isFinite(speedKmh) || speedKmh <= 0)
    throw Error("Travel speed must be greater than zero.");
  const radians = (value) => (value * Math.PI) / 180;
  const lat1 = radians(start.lat),
    lat2 = radians(end.lat);
  const haversine =
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(radians(end.lon - start.lon) / 2) ** 2;
  const angle =
    2 *
    Math.atan2(
      Math.sqrt(Math.max(0, Math.min(1, haversine))),
      Math.sqrt(Math.max(0, 1 - haversine)),
    );
  const distance = angle * LUNAR_MEAN_RADIUS_KM;
  return {
    start: { ...start },
    end: { ...end },
    mean_radius_km: LUNAR_MEAN_RADIUS_KM,
    distance_km: distance,
    angular_distance_degrees: (angle * 180) / Math.PI,
    speed_kmh: speedKmh,
    travel_hours: distance / speedKmh,
    limitations:
      "Shortest great-circle surface distance on a spherical Moon. Time = distance / entered average speed. No terrain, obstacles, slopes, rest stops or route feasibility model.",
  };
}
function sampleLunarArc(start, end, count = 128) {
  validateLunarPoint(start);
  validateLunarPoint(end);
  const rad = Math.PI / 180;
  const vector = (p) => [
    Math.cos(p.lat * rad) * Math.cos(p.lon * rad),
    Math.cos(p.lat * rad) * Math.sin(p.lon * rad),
    Math.sin(p.lat * rad),
  ];
  const a = vector(start),
    b = vector(end),
    dot = Math.max(
      -1,
      Math.min(
        1,
        a.reduce((sum, value, i) => sum + value * b[i], 0),
      ),
    );
  const angle = Math.acos(dot);
  if (angle < 1e-9) return [{ ...start }, { ...end }];
  let tangent = b.map((value, i) => value - dot * a[i]);
  let norm = Math.hypot(...tangent);
  // Antipodal points have many shortest paths. Choose a deterministic tangent.
  if (norm < 1e-10) {
    let axis = [0, 0, 1];
    if (Math.abs(a[2]) > 0.9) axis = [0, 1, 0];
    const projection = a.reduce((sum, value, i) => sum + value * axis[i], 0);
    tangent = axis.map((value, i) => value - projection * a[i]);
    norm = Math.hypot(...tangent);
  }
  tangent = tangent.map((value) => value / norm);
  return Array.from({ length: count + 1 }, (_, i) => {
    if (i === 0) return { ...start };
    if (i === count) return { ...end };
    const t = (angle * i) / count,
      v = a.map((value, j) => Math.cos(t) * value + Math.sin(t) * tangent[j]);
    return {
      lat: Math.atan2(v[2], Math.hypot(v[0], v[1])) / rad,
      lon: Math.atan2(v[1], v[0]) / rad,
    };
  });
}
