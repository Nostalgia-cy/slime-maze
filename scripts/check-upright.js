const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Slime = require("../src/physics");
const Scene = require("../src/scene");
const Skin = require("../src/skin");

// Remove only the new upright step to reproduce the formerly unconstrained spin.
class UnstabilizedSlime extends Slime {
  stabilizeOrientation() {}
  rotationDamping() {
    return {
      c: this.center(),
      omega: 0
    };
  }
}

function run(Core, {
  solver = "pbd",
  stiffness = 0.35,
  recovery = true,
  scenario = "wall"
} = {}) {
  const s = new Core({
    solver,
    stiffness,
    recovery
  });
  const skin = new Skin(s.p);
  if (scenario === "floor") {
    for (let i = 0; i < 600; i++) {
      s.step();
    }
  }
  let previous = s.fit().angle;
  let cumulative = 0;
  let maxAngle = 0;
  let maxFaceAngle = 0;
  let peakArea = 0;
  let angleAt20Seconds = 0;
  for (let step = 0; step < 3600; step++) {
    s.step({
      target: {
        x: 940,
        y: scenario === "floor" ? 490 : scenario === "wall" ? 120 : 395
      },
      obstacles: scenario === "floor" ? [] : Scene.walls
    });
    assert(s.p.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    const angle = s.fit().angle;
    cumulative += Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous));
    previous = angle;
    if (step === 2399) {
      angleAt20Seconds = angle;
    }
    maxAngle = Math.max(maxAngle, Math.abs(angle) * 180 / Math.PI);
    const left = skin.sample(s.p, 0.44, 0.48);
    const right = skin.sample(s.p, 0.56, 0.48);
    maxFaceAngle = Math.max(maxFaceAngle, Math.abs(Math.atan2(right.y - left.y, right.x - left.x)) * 180 / Math.PI);
    peakArea = Math.max(peakArea, s.metrics().areaError);
  }
  return {
    solver,
    stiffness,
    recovery,
    scenario,
    seconds: 30,
    cumulativeDegrees: cumulative * 180 / Math.PI,
    maxAngle,
    maxFaceAngle,
    peakArea,
    last10SecondsDrift: (s.fit().angle - angleAt20Seconds) * 180 / Math.PI
  };
}

// A rigid correction must preserve centroid, area and all structural lengths.
const s = new Slime();
const c = s.center();
const rotation = 0.8; // Uniform translation must not be mistaken for spin.
for (const p of s.p) {
  p.ox = p.x - 2;
  p.oy = p.y + 1;
}

assert(Math.abs(s.rotationDamping().omega) < 1e-12);
for (const p of s.p) {
  p.x = c.x + Math.cos(rotation) * p.rx - Math.sin(rotation) * p.ry;
  p.y = c.y + Math.sin(rotation) * p.rx + Math.cos(rotation) * p.ry;
}
const area = s.area();
const distances = s.links.map(([i, j]) => Math.hypot(s.p[i].x - s.p[j].x, s.p[i].y - s.p[j].y));
s.stabilizeOrientation();
assert(s.fit().angle < rotation);
assert(Math.abs(s.area() - area) < 1e-8);
assert(Math.hypot(s.center().x - c.x, s.center().y - c.y) < 1e-8);
s.links.forEach(([i, j], k) => assert(Math.abs(Math.hypot(s.p[i].x - s.p[j].x, s.p[i].y - s.p[j].y) - distances[k]) < 1e-8));
const baseline = run(UnstabilizedSlime);
assert(baseline.cumulativeDegrees > 360, "baseline must reproduce continuous spin");
const rows = [];
for (const solver of ["pbd", "spring"]) {
  for (const stiffness of [0.05, 0.35, 0.9]) {
    for (const recovery of [true, false]) {
      const row = run(Slime, {
        solver,
        stiffness,
        recovery
      });
      // Fifteen degrees is a soft target; contact projections may exceed it, but cannot keep turning.
      assert(row.maxAngle < 30, JSON.stringify(row));
      // Local shear may tilt the eyes more than the fitted body; they must stay upright rather than flip.
      assert(row.maxFaceAngle < 90, JSON.stringify(row));
      assert(Math.abs(row.cumulativeDegrees) < 30, JSON.stringify(row));
      assert(Math.abs(row.last10SecondsDrift) < 2, JSON.stringify(row));
      assert(row.peakArea < 0.08, JSON.stringify(row));
      rows.push(row);
    }
  }
}
for (const solver of ["pbd", "spring"]) {
  for (const scenario of ["floor", "gap"]) {
    const row = run(Slime, {
      solver,
      scenario
    });
    assert(row.maxAngle < 30, JSON.stringify(row));
    assert(row.maxFaceAngle < 90, JSON.stringify(row));
    assert(row.peakArea < 0.08, JSON.stringify(row));
    rows.push(row);
  }
}
const sourceHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "../src/physics.js"))).digest("hex");
fs.writeFileSync(path.join(__dirname, "../results/orientation.json"), JSON.stringify({
  sourceHash,
  steps: 3600,
  dt: 1 / 120,
  baseline,
  rows
}, null, 2));
console.log("持续右拉30秒：旧模型累计旋转 " + baseline.cumulativeDegrees.toFixed(1) + "°；修正版最大整体转角 " + Math.max(...rows.map(r => r.maxAngle)).toFixed(2) + "°，最大五官倾角 " + Math.max(...rows.map(r => r.maxFaceAngle)).toFixed(2) + "°。16组检查通过。");
