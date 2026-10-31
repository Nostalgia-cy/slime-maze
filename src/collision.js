(function (root) {
  // Open-interior clipping excludes tangency from penetration measurements.
  function segmentInterior(start, end, rect) {
    const epsilon = 1e-7;
    let enter = 0;
    let exit = 1;
    for (const [axis, lower, upper] of [["x", rect.x + epsilon, rect.x + rect.w - epsilon], ["y", rect.y + epsilon, rect.y + rect.h - epsilon]]) {
      const delta = end[axis] - start[axis];
      if (Math.abs(delta) < 1e-12) {
        if (start[axis] < lower || start[axis] > upper) {
          return null;
        }
        continue;
      }
      let entryTime = (lower - start[axis]) / delta;
      let exitTime = (upper - start[axis]) / delta;
      if (entryTime > exitTime) {
        [entryTime, exitTime] = [exitTime, entryTime];
      }
      enter = Math.max(enter, entryTime);
      exit = Math.min(exit, exitTime);
      if (enter >= exit) {
        return null;
      }
    }
    const t = (enter + exit) / 2;
    return {
      enter,
      exit,
      t,
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t
    };
  }

  function projectInside(point, rect) {
    if (point.x <= rect.x || point.x >= rect.x + rect.w || point.y <= rect.y || point.y >= rect.y + rect.h) {
      return null;
    }
    const depths = [point.x - rect.x, rect.x + rect.w - point.x, point.y - rect.y, rect.y + rect.h - point.y];
    const side = depths.indexOf(Math.min(...depths));
    return {
      x: side === 0 ? -depths[0] : side === 1 ? depths[1] : 0,
      y: side === 2 ? -depths[2] : side === 3 ? depths[3] : 0
    };
  }

  function metrics(points, rects) {
    let maxDepth = 0;
    let edgeCrossings = 0;
    for (let i = 0; i < points.length; i++) {
      for (const rect of rects) {
        const hit = segmentInterior(points[i], points[(i + 1) % points.length], rect);
        if (hit) {
          edgeCrossings++;
          const correction = projectInside(hit, rect);
          if (correction) {
            maxDepth = Math.max(maxDepth, Math.hypot(correction.x, correction.y));
          }
        }
      }
    }
    return {
      maxDepth,
      edgeCrossings
    };
  }

  function resolve(points, rects, passes = 1) {
    for (let pass = 0; pass < passes; pass++) {
      for (const point of points) {
        point.x = Math.max(8, Math.min(952, point.x));
        point.y = Math.max(8, Math.min(532, point.y));
        for (const rect of rects) {
          const correction = projectInside(point, rect);
          if (correction) {
            point.x += correction.x;
            point.y += correction.y;
          }
        }
      }
      // Both endpoints may be outside while the edge itself crosses a wall.
      for (let i = 0; i < points.length; i++) {
        for (const rect of rects) {
          const point = points[i];
          const nextPoint = points[(i + 1) % points.length];
          const hit = segmentInterior(point, nextPoint, rect);
          if (!hit) {
            continue;
          }
          const correction = projectInside(hit, rect);
          if (!correction) {
            continue;
          }
          const t = hit.t;
          const denominator = (1 - t) ** 2 + t * t;
          point.x += correction.x * (1 - t) / denominator;
          point.y += correction.y * (1 - t) / denominator;
          nextPoint.x += correction.x * t / denominator;
          nextPoint.y += correction.y * t / denominator;
        }
      }
    }
  }
  const api = {
    segmentInterior,
    projectInside,
    metrics,
    resolve
  };
  if (typeof module !== "undefined") {
    module.exports = api;
  } else {
    root.Collision = api;
  }
})(globalThis);
