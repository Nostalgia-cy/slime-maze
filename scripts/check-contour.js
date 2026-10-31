const assert = require("node:assert/strict");
const baseline = process.argv.includes("--baseline");
const Slime = require(baseline ? "./fixtures/physics-before-contour.cjs" : "../src/physics");
const Scene = require("../src/scene");
const fs = require("node:fs");
const path = require("node:path");
function sharpness(points, walls) {
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const clearance = Math.min(...walls.map(o => Math.hypot(Math.max(o.x - p.x, 0, p.x - o.x - o.w), Math.max(o.y - p.y, 0, p.y - o.y - o.h))));
    if (clearance < 10) {
      continue;
    }
    const a = points[(i + points.length - 1) % points.length];
    const b = points[(i + 1) % points.length];
    const ax = p.x - a.x;
    const ay = p.y - a.y;
    const bx = b.x - p.x;
    const by = b.y - p.y;
    const angle = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    max = Math.max(max, angle);
  }
  return max;
}
const rows = [];
for (const solver of ["pbd", "spring"]) {
  for (const recovery of [true, false]) {
    const s = new Slime({
      stiffness: 0.05,
      solver,
      recovery
    });
    let maxTurn = 0;
    let worst = null;
    let maxArea = 0;
    for (let i = 0; i < 1800; i++) {
      const target = i < 900 ? {
        x: 305,
        y: 220
      } : {
        x: 350,
        y: 395
      };
      s.step({
        target,
        obstacles: Scene.walls
      });
      const turn = sharpness(s.p, Scene.walls);
      if (turn > maxTurn) {
        maxTurn = turn;
        worst = s.p.map(p => ({
          x: p.x,
          y: p.y
        }));
      }
      maxArea = Math.max(maxArea, s.metrics().areaError);
    }
    rows.push({
      solver,
      recovery,
      maxFreeTurnDegrees: maxTurn * 180 / Math.PI,
      maxArea,
      worst
    });
  }
}
if (!baseline) {
  for (const row of rows) {
    assert(row.maxFreeTurnDegrees < 35, `${row.solver}: free contour developed a sharp fold`);
    assert(row.maxArea < 0.06);
  }
}
const file = baseline ? "contour-before.json" : "contour-after.json";
fs.writeFileSync(path.join(__dirname, "../results/轮廓修复", file), JSON.stringify(rows, null, 2));
console.log(rows.map(({
  worst,
  ...row
}) => row));
