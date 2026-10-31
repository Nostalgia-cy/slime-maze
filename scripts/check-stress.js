const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Slime = require("../src/physics");
const Collision = require("../src/collision");
const {
  walls
} = require("../src/scene");
const rows = [];
for (const solver of ["pbd", "spring"]) {
  for (const stiffness of [0.05, 0.35]) {
    const s = new Slime({
      solver,
      stiffness
    });
    let seed = 12345;
    let target = null;
    let maxDepth = 0;
    let maxAreaError = 0;
    for (let i = 0; i < 6000; i++) {
      if (i % 90 === 0) {
        seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
        const x = 20 + seed % 920;
        seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
        target = {
          x,
          y: 20 + seed % 500
        };
      }
      s.step({
        target,
        obstacles: walls
      });
      maxDepth = Math.max(maxDepth, Collision.metrics(s.p, walls).maxDepth);
      maxAreaError = Math.max(maxAreaError, s.metrics().areaError);
      assert(s.p.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    }

    assert(maxDepth < 0.02, `${solver}: depth ${maxDepth}`);
    assert(maxAreaError < 0.15, `${solver}: area ${maxAreaError}`);
    rows.push({
      solver,
      stiffness,
      seed: 12345,
      steps: 6000,
      seconds: 50,
      targetEverySteps: 90,
      maxDepth,
      maxAreaError
    });
  }
}
fs.writeFileSync(path.join(__dirname, "../results/stress.json"), JSON.stringify(rows, null, 2));
console.log(rows);
