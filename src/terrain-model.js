// Regional 8-neighbor A* routing over a measured DEM. Missing/steep cells and
// user exclusion zones are blocked. Time penalties are explicit assumptions.
function planTerrainRoute(grid, start, end, speedKmh, maxSlopeDeg, zones = []) {
  validateLunarPoint(start);
  validateLunarPoint(end);
  if (!Number.isFinite(speedKmh) || speedKmh <= 0)
    throw Error("Enter a positive travel speed.");
  if (!Number.isFinite(maxSlopeDeg) || maxSlopeDeg <= 0 || maxSlopeDeg > 45)
    throw Error("Slope limit must be above 0° and at most 45°.");
  const { rows, columns, heights, latitudes, longitudes } = grid,
    n = rows * columns;
  if (
    rows < 2 ||
    columns < 2 ||
    rows > 129 ||
    columns > 129 ||
    heights.length !== n ||
    latitudes.length !== rows ||
    longitudes.length !== columns
  )
    throw Error("Invalid terrain grid.");
  for (const zone of zones) {
    validateLunarPoint(zone);
    if (!Number.isFinite(zone.radiusKm) || zone.radiusKm <= 0)
      throw Error("Blocked zones require a positive radius.");
  }
  const point = (index) => ({
    lat: latitudes[Math.floor(index / columns)],
    lon: ((longitudes[index % columns] + 540) % 360) - 180,
  });
  const distance = (a, b) => calculateLunarRoute(a, b, 1).distance_km;
  const points = Array.from({ length: n }, (_, i) => point(i));
  const blocked = new Uint8Array(n),
    slopes = new Float64Array(n);
  let maxCellKm = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c,
        left = r * columns + Math.max(0, c - 1),
        right = r * columns + Math.min(columns - 1, c + 1),
        up = Math.max(0, r - 1) * columns + c,
        down = Math.min(rows - 1, r + 1) * columns + c;
      if (
        [i, left, right, up, down].some(
          (j) => heights[j] === null || !Number.isFinite(heights[j]),
        )
      ) {
        blocked[i] = 1;
        continue;
      }
      const dx = distance(points[left], points[right]) * 1000,
        dy = distance(points[up], points[down]) * 1000;
      const gradientX = dx ? (heights[right] - heights[left]) / dx : 0,
        gradientY = dy ? (heights[down] - heights[up]) / dy : 0;
      slopes[i] = (Math.atan(Math.hypot(gradientX, gradientY)) * 180) / Math.PI;
      if (slopes[i] > maxSlopeDeg) blocked[i] = 1;
      const cellX = dx / (c > 0 && c < columns - 1 ? 2 : 1) / 1000,
        cellY = dy / (r > 0 && r < rows - 1 ? 2 : 1) / 1000;
      const halfDiagonal = Math.hypot(cellX, cellY) / 2;
      maxCellKm = Math.max(maxCellKm, cellX, cellY);
      // Buffer zones by half a cell diagonal so a segment cannot cut through a
      // small marked obstacle just because the grid nodes lie outside it.
      if (
        zones.some(
          (zone) => distance(points[i], zone) <= zone.radiusKm + halfDiagonal,
        )
      )
        blocked[i] = 1;
    }
  function nearest(p) {
    let found = 0,
      best = Infinity;
    for (let i = 0; i < n; i++) {
      const d = distance(p, points[i]);
      if (d < best) {
        best = d;
        found = i;
      }
    }
    return found;
  }
  const first = nearest(start),
    last = nearest(end);
  if (blocked[first] || blocked[last])
    return {
      status: "blocked_endpoint",
      message:
        "An endpoint is on a steep, missing-data or excluded cell. Move it to traversable ground.",
      source: grid.source,
    };
  const costs = new Float64Array(n);
  costs.fill(Infinity);
  costs[first] = 0;
  const parent = new Int32Array(n);
  parent.fill(-1);
  const closed = new Uint8Array(n);
  const heap = [];
  const push = (entry) => {
    heap.push(entry);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= entry.f) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = entry;
  };
  const pop = () => {
    const top = heap[0],
      tail = heap.pop();
    if (heap.length) {
      let i = 0;
      while (true) {
        let c = i * 2 + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++;
        if (heap[c].f >= tail.f) break;
        heap[i] = heap[c];
        i = c;
      }
      heap[i] = tail;
    }
    return top;
  };
  push({ i: first, f: distance(points[first], points[last]) / speedKmh });
  while (heap.length) {
    const { i } = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === last) break;
    const r = Math.floor(i / columns),
      c = i % columns;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr,
          nc = c + dc;
        if ((!dr && !dc) || nr < 0 || nr >= rows || nc < 0 || nc >= columns)
          continue;
        const j = nr * columns + nc;
        if (blocked[j] || closed[j]) continue;
        if (
          dr &&
          dc &&
          (blocked[(r + dr) * columns + c] || blocked[r * columns + c + dc])
        )
          continue;
        const horizontal = distance(points[i], points[j]),
          rise = (heights[j] - heights[i]) / 1000,
          grade = Math.abs(rise) / Math.max(horizontal, 1e-12);
        if ((Math.atan(grade) * 180) / Math.PI > maxSlopeDeg) continue;
        const stepHours =
          (Math.hypot(horizontal, rise) / speedKmh) * (1 + 5 * grade);
        if (costs[i] + stepHours < costs[j]) {
          costs[j] = costs[i] + stepHours;
          parent[j] = i;
          push({
            i: j,
            f: costs[j] + distance(points[j], points[last]) / speedKmh,
          });
        }
      }
  }
  if (!closed[last])
    return {
      status: "no_path",
      message:
        "No route found within this regional grid and slope/obstacle constraints. This does not prove that no real-world route exists.",
      source: grid.source,
    };
  const indices = [];
  for (let i = last; i !== -1; i = parent[i]) indices.push(i);
  indices.reverse();
  const path =
    first === last
      ? [
          { ...start, elevation_m: heights[first] },
          { ...end, elevation_m: heights[last] },
        ]
      : [
          { ...start, elevation_m: heights[first] },
          ...indices.map((i) => ({ ...points[i], elevation_m: heights[i] })),
          { ...end, elevation_m: heights[last] },
        ];
  let terrainKm = 0,
    groundKm = 0,
    ascent = 0,
    descent = 0,
    time = 0,
    maxPathSlope = 0;
  const profile = [{ distance_km: 0, elevation_m: path[0].elevation_m }];
  for (let i = 1; i < path.length; i++) {
    const horizontal = distance(path[i - 1], path[i]),
      rise = (path[i].elevation_m - path[i - 1].elevation_m) / 1000;
    const grade = Math.abs(rise) / Math.max(horizontal, 1e-12),
      segment = Math.hypot(horizontal, rise);
    groundKm += horizontal;
    terrainKm += segment;
    time += (segment / speedKmh) * (1 + 5 * grade);
    ascent += Math.max(0, rise * 1000);
    descent += Math.max(0, -rise * 1000);
    maxPathSlope = Math.max(maxPathSlope, (Math.atan(grade) * 180) / Math.PI);
    profile.push({ distance_km: terrainKm, elevation_m: path[i].elevation_m });
  }
  return {
    status: "ok",
    start,
    end,
    path,
    profile,
    distance_km: terrainKm,
    ground_distance_km: groundKm,
    ascent_m: ascent,
    descent_m: descent,
    travel_hours: time,
    max_path_slope_degrees: maxPathSlope,
    max_cell_slope_degrees: Math.max(...indices.map((i) => slopes[i])),
    slope_limit_degrees: maxSlopeDeg,
    speed_kmh: speedKmh,
    analysis_grid_max_step_km: maxCellKm,
    source: grid.source,
    source_url: grid.source_url,
    native_resolution_m: grid.native_resolution_m,
    exclusion_zones: zones,
    scope:
      "Minimum modeled travel-time path inside a bounded grid, not a globally optimal or validated safe route.",
    time_model:
      "Segment time = 3D distance / flat-ground speed × (1 + 5 × absolute rise/run). Heuristic slowdown, not a validated rover model.",
    limitations:
      "Large-scale DEM terrain only. Slopes and elevation changes below grid resolution, rocks/boulders, soil strength, wheel traction, illumination and vehicle dynamics are not resolved. Endpoint heights use nearest grid cells. Regional search may miss routes outside the patch.",
  };
}
