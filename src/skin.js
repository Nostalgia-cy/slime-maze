// Mean value coordinates bind interior details to the soft body's rest contour.
(function (root) {
  class SoftBodySkin {
    constructor(restPoints) {
      this.rest = restPoints.map(p => ({
        x: p.rx,
        y: p.ry
      }));
      this.cache = new Map();
    }

    weights(u, v) {
      const key = `${u},${v}`;
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }

      // Keep the original artwork's material coordinates and size.
      const x = (u - 0.5) * 180;
      const y = (v - 0.5) * 180;
      const vectors = this.rest.map(p => ({
        x: p.x - x,
        y: p.y - y
      }));
      const distances = vectors.map(p => Math.hypot(p.x, p.y));
      const n = vectors.length;
      const weights = new Array(n).fill(0);
      const vertex = distances.findIndex(d => d < 1e-9);
      if (vertex >= 0) {
        weights[vertex] = 1;
      } else {
        const halfAngles = vectors.map((a, i) => {
          const j = (i + 1) % n;
          const b = vectors[j];
          return Math.tan(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y) / 2);
        });
        let sum = 0;
        for (let i = 0; i < n; i++) {
          weights[i] = (halfAngles[(i + n - 1) % n] + halfAngles[i]) / distances[i];
          sum += weights[i];
        }
        for (let i = 0; i < n; i++) {
          weights[i] /= sum;
        }
      }
      // Only the fixed artwork samples are cached; current positions are never cached.
      this.cache.set(key, weights);
      return weights;
    }

    sample(points, u, v) {
      const weights = this.weights(u, v);
      let x = 0;
      let y = 0;
      for (let i = 0; i < weights.length; i++) {
        x += weights[i] * points[i].x;
        y += weights[i] * points[i].y;
      }
      return {
        x,
        y
      };
    }
  }
  if (typeof module !== "undefined") {
    module.exports = SoftBodySkin;
  } else {
    root.SoftBodySkin = SoftBodySkin;
  }
})(globalThis);
