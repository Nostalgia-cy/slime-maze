const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const Slime = require("../src/physics");
const Collision = require("../src/collision");
const Scene = require("../src/scene");
const out = path.join(__dirname, "../results/depth-study");
fs.mkdirSync(out, {
  recursive: true
});
const variants = {
  base: {
    fairing: false,
    minEdge: false,
    bendLimit: false
  },
  smooth: {
    fairing: true,
    minEdge: false,
    bendLimit: false
  },
  smoothEdge: {
    fairing: true,
    minEdge: true,
    bendLimit: false
  },
  full: {
    fairing: true,
    minEdge: true,
    bendLimit: true
  },
  withoutSmooth: {
    fairing: false,
    minEdge: true,
    bendLimit: true
  },
  withoutMinEdge: {
    fairing: true,
    minEdge: false,
    bendLimit: true
  }
};
function diagnostics(p, walls) {
  let turn = 0;
  let selfCrossings = 0;
  let minEdge = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[(i + p.length - 1) % p.length];
    const b = p[i];
    const c = p[(i + 1) % p.length];
    const clearance = Math.min(...walls.map(o => Math.hypot(Math.max(o.x - b.x, 0, b.x - o.x - o.w), Math.max(o.y - b.y, 0, b.y - o.y - o.h))));
    minEdge = Math.min(minEdge, Math.hypot(c.x - b.x, c.y - b.y));
    if (clearance >= 10) {
      turn = Math.max(turn, Math.abs(Math.atan2((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y))));
    }
  }
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 2; j < p.length; j++) {
      if (i === 0 && j === p.length - 1) {
        continue;
      }
      const a = p[i];
      const b = p[(i + 1) % p.length];
      const c = p[j];
      const d = p[(j + 1) % p.length];
      if (cross(a, b, c) * cross(a, b, d) < -1e-9 && cross(c, d, a) * cross(c, d, b) < -1e-9) {
        selfCrossings++;
      }
    }
  }
  return {
    freeTurnDegrees: turn * 180 / Math.PI,
    selfCrossings,
    minEdge
  };
}

function run(spec, collect) {
  const s = new Slime({
    ...variants[spec.variant],
    solver: spec.solver,
    stiffness: spec.stiffness,
    recovery: spec.recovery
  });
  const walls = spec.protocol === "gap" ? [{
    x: 440,
    y: 0,
    w: 40,
    h: 270 - spec.gap / 2
  }, {
    x: 440,
    y: 270 + spec.gap / 2,
    w: 40,
    h: 270 - spec.gap / 2
  }] : Scene.walls;
  if (spec.protocol === "gap") {
    const c = s.center();
    for (const p of s.p) {
      p.x += 170 - c.x;
      p.y += 270 - c.y;
      p.ox = p.x;
      p.oy = p.y;
    }
  }
  const samples = [];
  const snapshots = {};
  let peakArea = 0;
  let peakShape = 0;
  let maxDepth = 0;
  let maxFreeTurn = 0;
  let maxSelfCrossings = 0;
  let minEdge = Infinity;
  let invalidArea = false;
  let crossStep = null;
  let dwell = 0;
  let recoveryStep = null;
  let recoveryDwell = 0;
  let elapsed = 0;
  let finite = true;
  let executedSteps = 0;
  const hash = crypto.createHash("sha256");
  for (let step = 0; step < 1800; step++) {
    const released = spec.protocol === "pressure" && step >= 1080;
    const target = spec.protocol === "gap" ? step < 120 ? {
      x: 170,
      y: 270
    } : {
      x: 780,
      y: 270
    } : step < 720 ? {
      x: 305,
      y: 220
    } : step < 1080 ? {
      x: 350,
      y: 395
    } : null;
    const start = performance.now();
    s.step({
      target,
      obstacles: released ? [] : walls,
      gravity: 0
    });
    elapsed += performance.now() - start;
    executedSteps++;
    if (!s.p.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) {
      finite = false;
      break;
    }
    if (spec.protocol === "gap") {
      dwell = s.p.every(p => p.x > 482) ? dwell + 1 : 0;
      if (crossStep === null && dwell >= 60) {
        crossStep = step - 59;
      }
    }
    if (step % 12 !== 0 && step !== 1799) {
      continue;
    }
    hash.update(JSON.stringify(s.p.map(p => [p.x, p.y])));
    if (!collect) {
      continue;
    }
    const m = s.metrics();
    const d = diagnostics(s.p, released ? [] : walls);
    const contacts = Collision.metrics(s.p, released ? [] : walls);
    if (m.areaError > peakArea) {
      peakArea = m.areaError;
      snapshots.maxArea = s.p.map(p => ({
        x: p.x,
        y: p.y
      }));
    }
    if (d.freeTurnDegrees > maxFreeTurn) {
      maxFreeTurn = d.freeTurnDegrees;
      snapshots.maxTurn = s.p.map(p => ({
        x: p.x,
        y: p.y
      }));
    }
    peakShape = Math.max(peakShape, m.shapeError);
    maxDepth = Math.max(maxDepth, contacts.maxDepth);
    maxSelfCrossings = Math.max(maxSelfCrossings, d.selfCrossings);
    minEdge = Math.min(minEdge, d.minEdge);
    invalidArea = invalidArea || s.area() <= 0;
    if (released) {
      recoveryDwell = m.shapeError < 0.02 ? recoveryDwell + 1 : 0;
      if (recoveryStep === null && recoveryDwell >= 6) {
        recoveryStep = step - 60;
      }
    }
    samples.push({
      step,
      time: (step + 1) / 120,
      center: s.center(),
      ...m,
      ...d,
      ...contacts
    });
  }
  if (collect) {
    snapshots.final = s.p.map(p => ({
      x: p.x,
      y: p.y
    }));
  }
  const geometricPassed = crossStep !== null;
  return {
    coreMsPerStep: elapsed / executedSteps,
    executedSteps,
    fingerprint: hash.digest("hex"),
    finite,
    geometricPassed,
    acceptedPass: geometricPassed && finite && !invalidArea && peakArea <= 0.1 && maxDepth <= 0.5 && maxSelfCrossings === 0 && maxFreeTurn <= 60,
    crossingSeconds: crossStep === null ? null : (crossStep - 120 + 1) / 120,
    recoverySeconds: recoveryStep === null ? null : (recoveryStep - 1080 + 1) / 120,
    peakArea,
    peakShape,
    maxDepth,
    maxFreeTurn,
    maxSelfCrossings,
    minEdge,
    invalidArea,
    samples,
    snapshots
  };
}
const cases = [];
for (const solver of ["pbd", "spring"]) {
  for (const recovery of [true, false]) {
    for (const variant of Object.keys(variants)) {
      cases.push({
        protocol: "pressure",
        solver,
        recovery,
        variant,
        stiffness: 0.05
      });
    }
  }
}
for (const solver of ["pbd", "spring"]) {
  for (const stiffness of [0.05, 0.8]) {
    for (const variant of ["base", "smooth", "smoothEdge", "full"]) {
      for (const gap of [100, 84, 72, 60, 48, 36]) {
        cases.push({
          protocol: "gap",
          solver,
          recovery: true,
          variant,
          stiffness,
          gap
        });
      }
    }
  }
}
const metadata = {
  environment: {
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpu: os.cpus()[0].model
  },
  sourceHashes: Object.fromEntries(["physics.js", "collision.js", "scene.js"].map(f => [f, crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "../src", f))).digest("hex")])),
  orientation: {
    limitDegrees: 15,
    angularDamping: 0.95,
    relaxation: 0.01,
    maxRotationPerProjection: 0.002,
    onceAfterPrediction: true,
    sharedAcrossVariants: true
  },
  dt: 1 / 120,
  steps: 1800,
  sampleEvery: 12,
  particleCount: 64,
  iterations: 8,
  repetitions: 3,
  warmups: 1,
  variants,
  protocols: {
    pressure: "target(305,220) steps0..719; target(350,395) steps720..1079; remove target/walls steps1080..1799; gravity0",
    gap: "initial center170,270; wall x440..480; centered gap; hold target170,270 for120steps then780,270; gravity0; cross requires entire boundary x>482 for60steps"
  },
  metrics: "maxima and self-crossing diagnostics sampled every12steps plus final; core step timing excludes diagnostics; acceptedPass means geometricPass plus sampled area error<=10%, penetration<=0.5px, no sampled proper self-crossings, free turn<=60deg, positive signed area and finite states; these are animation-quality criteria, not physical ground truth",
  limitations: "Proper self-crossings exclude tangencies and collinear overlap. Sampling is not continuous collision or no-fold proof. Recovery uses six consecutive sampled points below2%, spanning0.5sec. Spring/PBD stiffness values are not calibrated equal materials."
};
fs.writeFileSync(path.join(out, "cases.json"), JSON.stringify({
  metadata,
  cases
}, null, 2));
fs.writeFileSync(path.join(out, "runs.jsonl"), "");
const rows = [];
for (let index = 0; index < cases.length; index++) {
  const spec = cases[index];
  run(spec, false);
  const first = run(spec, true);
  const repeat = [run(spec, false), run(spec, false)];
  if (!repeat.every(r => r.fingerprint === first.fingerprint)) {
    throw Error("trajectory mismatch " + JSON.stringify(spec));
  }
  const times = [first.coreMsPerStep, ...repeat.map(r => r.coreMsPerStep)];
  const row = {
    ...spec,
    ...first,
    coreMsPerStep: times.sort((a, b) => a - b)[1],
    timingRuns: times
  };
  rows.push(row);
  fs.appendFileSync(path.join(out, "runs.jsonl"), JSON.stringify(row) + "\n");
  if ((index + 1) % 12 === 0 || index === cases.length - 1) {
    console.log(`完成 ${index + 1}/${cases.length}`);
  }
}
fs.writeFileSync(path.join(out, "study.json"), JSON.stringify({
  metadata,
  rows
}, null, 2));
const fields = ["protocol", "solver", "recovery", "variant", "stiffness", "gap", "geometricPassed", "acceptedPass", "crossingSeconds", "recoverySeconds", "peakArea", "peakShape", "maxDepth", "maxFreeTurn", "maxSelfCrossings", "minEdge", "coreMsPerStep"];
fs.writeFileSync(path.join(out, "summary.csv"), fields.join(",") + "\n" + rows.map(r => fields.map(k => r[k] ?? "").join(",")).join("\n"));
console.log("全部完成；原始数据、采样轨迹指纹和摘要已保存。");
