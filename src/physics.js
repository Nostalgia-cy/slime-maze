/* Shared browser/Node core. PBD: stiffness depends on iteration count. */
(function (root) {
  const collision = typeof module !== "undefined" ? require("./collision") : root.Collision;

  // Public particle fields are shared with drawing and experiment scripts:
  // x/y = current, ox/oy = previous, rx/ry = rest offset from the center.
  class Slime {
    constructor({
      stiffness = 0.35,
      iterations = 8,
      recovery = true,
      solver = "pbd",
      fairing = true,
      minEdge = true,
      bendLimit = true
    } = {}) {
      this.fairing = fairing;
      this.minEdge = minEdge;
      this.bendLimit = bendLimit;
      this.solver = solver;
      this.stiffness = stiffness;
      this.iterations = iterations;
      this.recovery = recovery;
      this.n = 64;
      this.r = 42;
      this.p = Array.from({
        length: this.n
      }, (_, i) => {
        const angle = i * 2 * Math.PI / this.n;
        const x = this.r * Math.cos(angle);
        const y = this.r * Math.sin(angle);
        return {
          x: x + 110,
          y: y + 120,
          ox: x + 110,
          oy: y + 120,
          rx: x,
          ry: y
        };
      });
      this.a0 = this.area();
      this.links = [];
      for (let i = 0; i < this.n; i++) {
        for (const neighborOffset of [1, 8]) {
          const j = (i + neighborOffset) % this.n;
          this.links.push([i, j, Math.hypot(this.p[i].rx - this.p[j].rx, this.p[i].ry - this.p[j].ry)]);
        }
      }
    }

    area() {
      return this.p.reduce((sum, point, i) => {
        const nextPoint = this.p[(i + 1) % this.n];
        return sum + (point.x * nextPoint.y - nextPoint.x * point.y) / 2;
      }, 0);
    }

    center() {
      return this.p.reduce((center, point) => ({
        x: center.x + point.x / this.n,
        y: center.y + point.y / this.n
      }), {
        x: 0,
        y: 0
      });
    }

    fit() {
      const center = this.center();
      let dotSum = 0;
      let crossSum = 0;
      for (const point of this.p) {
        dotSum += point.rx * (point.x - center.x) + point.ry * (point.y - center.y);
        crossSum += point.rx * (point.y - center.y) - point.ry * (point.x - center.x);
      }
      return {
        c: center,
        angle: Math.atan2(crossSum, dotSum)
      };
    }

    metrics() {
      const fit = this.fit();
      const cos = Math.cos(fit.angle);
      const sin = Math.sin(fit.angle);
      return {
        areaError: Math.abs(this.area() / this.a0 - 1),
        shapeError: Math.sqrt(this.p.reduce((sum, point) =>
          sum + (point.x - fit.c.x - cos * point.rx + sin * point.ry) ** 2 +
          (point.y - fit.c.y - sin * point.rx - cos * point.ry) ** 2,
        0) / this.n) / this.r,
        distanceError: this.links.reduce((sum, [i, j, restLength]) =>
          sum + Math.abs(Math.hypot(this.p[i].x - this.p[j].x, this.p[i].y - this.p[j].y) - restLength),
        0) / this.links.length
      };
    }

    projectArea() {
      const gradients = this.p.map((point, i) => {
        const previousPoint = this.p[(i + this.n - 1) % this.n];
        const nextPoint = this.p[(i + 1) % this.n];
        return {
          x: (nextPoint.y - previousPoint.y) / 2,
          y: (previousPoint.x - nextPoint.x) / 2
        };
      });
      const denominator = gradients.reduce((sum, gradient) => sum + gradient.x * gradient.x + gradient.y * gradient.y, 0);
      const lambda = (this.area() - this.a0) / (denominator || 1) * 0.65;
      this.p.forEach((point, i) => {
        point.x -= lambda * gradients[i].x;
        point.y -= lambda * gradients[i].y;
      });
    }

    regularizeContour() {
      // Curvature fairing damps local spikes; compensate the circular rest mode to avoid shrinkage.
      if (this.fairing) {
        const center = this.center();
        const restCurvature = 1 - Math.cos(2 * Math.PI / this.n);
        const moves = this.p.map((point, i) => {
          const previousPoint = this.p[(i + this.n - 1) % this.n];
          const nextPoint = this.p[(i + 1) % this.n];
          return {
            x: ((previousPoint.x + nextPoint.x) / 2 - point.x + restCurvature * (point.x - center.x)) * 0.5,
            y: ((previousPoint.y + nextPoint.y) / 2 - point.y + restCurvature * (point.y - center.y)) * 0.5
          };
        });
        this.p.forEach((point, i) => {
          point.x += moves[i].x;
          point.y += moves[i].y;
        });
      }
      // Prevent tiny collapsed boundary edges from becoming folded spikes.
      const minLength = 2 * this.r * Math.sin(Math.PI / this.n) * 0.6;
      if (this.minEdge) {
        for (let i = 0; i < this.n; i++) {
          const point = this.p[i];
          const nextPoint = this.p[(i + 1) % this.n];
          const dx = nextPoint.x - point.x;
          const dy = nextPoint.y - point.y;
          const distance = Math.hypot(dx, dy);
          if (distance < minLength) {
            const restAngle = Math.atan2(nextPoint.ry - point.ry, nextPoint.rx - point.rx);
            const nx = distance > 1e-8 ? dx / distance : Math.cos(restAngle);
            const ny = distance > 1e-8 ? dy / distance : Math.sin(restAngle);
            const amount = (minLength - distance) * 0.5;
            point.x -= nx * amount;
            point.y -= ny * amount;
            nextPoint.x += nx * amount;
            nextPoint.y += ny * amount;
          }
        }
      }
      // Bound turning angles with a three-particle PBD constraint, even when shape recovery is disabled.
      if (this.bendLimit) {
        for (let sweep = 0; sweep < 3; sweep++) {
          for (let i = 0; i < this.n; i++) {
            const previousPoint = this.p[(i + this.n - 1) % this.n];
            const point = this.p[i];
            const nextPoint = this.p[(i + 1) % this.n];
            const ux = point.x - previousPoint.x;
            const uy = point.y - previousPoint.y;
            const vx = nextPoint.x - point.x;
            const vy = nextPoint.y - point.y;
            const u2 = ux * ux + uy * uy;
            const v2 = vx * vx + vy * vy;
            if (u2 < 1e-8 || v2 < 1e-8) {
              continue;
            }
            const angle = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
            if (Math.abs(angle) <= 0.3) {
              continue;
            }
            const previousGradient = {
              x: -uy / u2,
              y: ux / u2
            };
            const nextGradient = {
              x: -vy / v2,
              y: vx / v2
            };
            const pointGradient = {
              x: -previousGradient.x - nextGradient.x,
              y: -previousGradient.y - nextGradient.y
            };
            const denominator =
              previousGradient.x * previousGradient.x + previousGradient.y * previousGradient.y +
              nextGradient.x * nextGradient.x + nextGradient.y * nextGradient.y +
              pointGradient.x * pointGradient.x + pointGradient.y * pointGradient.y;
            let lambda = -(angle - Math.sign(angle) * 0.3) / denominator;
            // Large angular errors invalidate the linear approximation; bound each local projection.
            const maxGradient = Math.max(
              Math.hypot(previousGradient.x, previousGradient.y),
              Math.hypot(pointGradient.x, pointGradient.y),
              Math.hypot(nextGradient.x, nextGradient.y)
            );
            const maxMove = 0.2 * Math.min(Math.sqrt(u2), Math.sqrt(v2));
            lambda *= Math.min(1, maxMove / (Math.abs(lambda) * maxGradient));
            previousPoint.x += lambda * previousGradient.x;
            previousPoint.y += lambda * previousGradient.y;
            point.x += lambda * pointGradient.x;
            point.y += lambda * pointGradient.y;
            nextPoint.x += lambda * nextGradient.x;
            nextPoint.y += lambda * nextGradient.y;
          }
        }
      }
    }

    rotationDamping() {
      // Dampen rigid spin while preserving translation and the nonrigid velocity component.
      const center = this.center();
      let momentum = 0;
      let inertia = 0;
      for (const point of this.p) {
        const x = point.x - center.x;
        const y = point.y - center.y;
        momentum += x * (point.y - point.oy) - y * (point.x - point.ox);
        inertia += x * x + y * y;
      }
      return {
        c: center,
        omega: 0.95 * momentum / (inertia || 1)
      };
    }

    stabilizeOrientation() {
      // The character has an upright frame: bound global turning without erasing local strain.
      const {
        c: center,
        angle
      } = this.fit();
      const limit = 15 * Math.PI / 180;
      const excess = angle - Math.max(-limit, Math.min(limit, angle));
      if (Math.abs(excess) < 1e-10) {
        return;
      }
      // One gentle correction after prediction preserves local strain; the full contact solve follows.
      const correction = Math.max(-0.002, Math.min(0.002, -0.01 * excess));
      const cos = Math.cos(correction);
      const sin = Math.sin(correction);
      for (const point of this.p) {
        const x = point.x - center.x;
        const y = point.y - center.y;
        point.x = center.x + cos * x - sin * y;
        point.y = center.y + sin * x + cos * y;
      }
    }

    step({
      target = null,
      obstacles = [],
      gravity = 650
    } = {}) {
      const timeStep = 1 / 120;
      const forces = this.p.map(() => ({
        x: 0,
        y: 0
      }));
      // 1. Accumulate spring forces before changing any particle positions.
      if (this.solver === "spring") {
        for (const [i, j, restLength] of this.links) {
          const point = this.p[i];
          const neighbor = this.p[j];
          const dx = neighbor.x - point.x;
          const dy = neighbor.y - point.y;
          const distance = Math.hypot(dx, dy) || 1;
          const nx = dx / distance;
          const ny = dy / distance;
          const relativeSpeed = (
            (neighbor.x - neighbor.ox - point.x + point.ox) * nx +
            (neighbor.y - neighbor.oy - point.y + point.oy) * ny
          ) / timeStep;
          const force = (150 + 2000 * this.stiffness) * (distance - restLength) + 7 * relativeSpeed;
          forces[i].x += force * nx;
          forces[i].y += force * ny;
          forces[j].x -= force * nx;
          forces[j].y -= force * ny;
        }
      }
      // 2. Predict positions after removing the rigid spin component.
      const {
        c: spinCenter,
        omega
      } = this.rotationDamping();
      for (let i = 0; i < this.n; i++) {
        const point = this.p[i];
        const vx = Math.max(-3, Math.min(3, (point.x - point.ox + omega * (point.y - spinCenter.y)) * 0.985));
        const vy = Math.max(-3, Math.min(3, (point.y - point.oy - omega * (point.x - spinCenter.x)) * 0.985));
        point.ox = point.x;
        point.oy = point.y;
        point.x += vx + forces[i].x * timeStep * timeStep;
        point.y += vy + (gravity + forces[i].y) * timeStep * timeStep;
      }
      this.stabilizeOrientation();

      // 3. Keep this order: structure, contour, area, recovery, drive, contacts.
      for (let iteration = 0; iteration < this.iterations; iteration++) {
        if (this.solver === "pbd") {
          for (const [i, j, restLength] of this.links) {
            const point = this.p[i];
            const neighbor = this.p[j];
            const dx = neighbor.x - point.x;
            const dy = neighbor.y - point.y;
            const distance = Math.hypot(dx, dy) || 1;
            const correctionScale = (distance - restLength) / distance * this.stiffness * 0.5;
            point.x += dx * correctionScale;
            point.y += dy * correctionScale;
            neighbor.x -= dx * correctionScale;
            neighbor.y -= dy * correctionScale;
          }
        }
        this.regularizeContour();
        this.projectArea();
        if (this.recovery) {
          const recoveryStrength = 0.001 + 0.011 * (this.stiffness / 0.35) ** 2;
          const {
            c: center,
            angle
          } = this.fit();
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          for (const point of this.p) {
            point.x += (center.x + cos * point.rx - sin * point.ry - point.x) * recoveryStrength;
            point.y += (center.y + sin * point.rx + cos * point.ry - point.y) * recoveryStrength;
          }
        }
        if (target) {
          const center = this.center();
          const dx = Math.max(-2, Math.min(2, (target.x - center.x) * 0.025));
          const dy = Math.max(-2, Math.min(2, (target.y - center.y) * 0.025));
          for (const point of this.p) {
            point.x += dx / this.iterations;
            point.y += dy / this.iterations;
          }
        }
        collision.resolve(this.p, obstacles);
      }
      // Finish with contacts, so later structural corrections cannot reintroduce visible penetration.
      for (let pass = 0; pass < 6; pass++) {
        this.regularizeContour();
        this.projectArea();
        collision.resolve(this.p, obstacles, 8);
      }
      collision.resolve(this.p, obstacles, 12);
    }
  }
  if (typeof module !== "undefined") {
    module.exports = Slime;
  } else {
    root.Slime = Slime;
  }
})(globalThis);
