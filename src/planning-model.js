// Pure planning math shared by the page and tests.
function calculateDeltaVBudget(maneuvers, reservePercent) {
  if (
    !Number.isFinite(reservePercent) ||
    reservePercent < 0 ||
    reservePercent > 100
  ) {
    throw Error("Reserve must be between 0 and 100 percent.");
  }
  const vehicles = {};
  for (const maneuver of maneuvers) {
    if (
      !maneuver.vehicle ||
      !Number.isFinite(maneuver.deltaV) ||
      maneuver.deltaV < 0
    ) {
      throw Error("Each maneuver needs a vehicle and a nonnegative Δv.");
    }
    vehicles[maneuver.vehicle] =
      (vehicles[maneuver.vehicle] || 0) + maneuver.deltaV;
  }
  const subtotal = Object.values(vehicles).reduce(
    (sum, value) => sum + value,
    0,
  );
  const factor = 1 + reservePercent / 100;
  return {
    maneuvers,
    subtotal_ms: subtotal,
    reserve_percent: reservePercent,
    reserve_ms: (subtotal * reservePercent) / 100,
    total_ms: subtotal * factor,
    vehicles: Object.entries(vehicles).map(([name, value]) => ({
      name,
      subtotal_ms: value,
      reserve_ms: (value * reservePercent) / 100,
      total_ms: value * factor,
    })),
    scope:
      "Sum of entered maneuver requirements, not a calculated trajectory or financial cost. Propellant must be sized separately for each vehicle/stage and mass history.",
  };
}

function parseHorizonsUtc(epoch) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const match = epoch
    .trim()
    .match(/^(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})(?::([\d.]+))?$/);
  if (!match || !months.includes(match[2]))
    throw Error("Unsupported Horizons UTC timestamp.");
  const [, year, month, day, hour, minute, second = "0"] = match;
  return Date.UTC(+year, months.indexOf(month), +day, +hour, +minute, +second);
}

// Integrate time above 0° by linearly interpolating between elevation samples.
// Crossings have sample-scale uncertainty; no claim of uninterrupted visibility
// or occultation/terrain awareness is made between samples.
function summarizeHorizonWindow(samples) {
  if (!Array.isArray(samples) || samples.length < 2)
    throw Error("At least two horizon samples are required.");
  const points = samples.map((sample) => ({
    time: parseHorizonsUtc(sample.epoch),
    elevation: sample.elevation,
  }));
  const above = [],
    rises = [],
    sets = [];
  let maxStep = 0;
  function addInterval(start, end) {
    if (end <= start) return;
    const previous = above.at(-1);
    if (previous && previous.end === start) previous.end = end;
    else above.push({ start, end });
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (
      !Number.isFinite(a.elevation) ||
      !Number.isFinite(b.elevation) ||
      b.time <= a.time
    )
      throw Error("Invalid or unordered horizon samples.");
    maxStep = Math.max(maxStep, b.time - a.time);
    if (a.elevation > 0 && b.elevation > 0) addInterval(a.time, b.time);
    else if (a.elevation > 0 && b.elevation <= 0) {
      const crossing =
        a.time +
        ((b.time - a.time) * a.elevation) / (a.elevation - b.elevation);
      addInterval(a.time, crossing);
      sets.push(crossing);
    } else if (a.elevation <= 0 && b.elevation > 0) {
      const crossing =
        a.time +
        ((b.time - a.time) * -a.elevation) / (b.elevation - a.elevation);
      addInterval(crossing, b.time);
      rises.push(crossing);
    } else if (a.elevation === 0 && b.elevation < 0) sets.push(a.time);
  }
  const start = points[0].time,
    end = points.at(-1).time;
  const visibleMs = above.reduce(
    (sum, interval) => sum + interval.end - interval.start,
    0,
  );
  return {
    start_utc: new Date(start).toISOString(),
    end_utc: new Date(end).toISOString(),
    window_hours: (end - start) / 3600000,
    above_horizon_hours: visibleMs / 3600000,
    above_horizon_percent: (visibleMs / (end - start)) * 100,
    longest_above_horizon_hours:
      above.reduce(
        (longest, interval) => Math.max(longest, interval.end - interval.start),
        0,
      ) / 3600000,
    next_rise_utc: rises.length ? new Date(rises[0]).toISOString() : null,
    next_set_utc: sets.length ? new Date(sets[0]).toISOString() : null,
    intervals_utc: above.map((interval) => ({
      start: new Date(interval.start).toISOString(),
      end: new Date(interval.end).toISOString(),
    })),
    sample_count: points.length,
    max_sample_step_minutes: maxStep / 60000,
    starts_above_horizon: points[0].elevation > 0,
  };
}
