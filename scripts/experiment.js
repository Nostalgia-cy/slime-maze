const Slime = require("../src/physics");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("node:crypto");
const configs = [["default", {}], ["spring", {
  solver: "spring"
}], ["soft", {
  stiffness: 0.1
}], ["hard", {
  stiffness: 0.8
}], ["iterations2", {
  iterations: 2
}], ["iterations16", {
  iterations: 16
}], ["noRecovery", {
  recovery: false
}]];
function run(opts, collect) {
  const s = new Slime(opts);
  const samples = [];
  const times = [];
  for (let i = 0; i < 1800; i++) {
    const t = performance.now();
    s.step({
      gravity: 0,
      target: i < 600 ? {
        x: 200,
        y: 200
      } : null,
      obstacles: i < 600 ? [{
        x: 180,
        y: 0,
        w: 30,
        h: 190
      }] : []
    });
    times.push(performance.now() - t);
    if (collect) {
      samples.push({
        step: i,
        time: (i + 1) / 120,
        ...s.metrics()
      });
    }
    if (!s.p.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) {
      throw Error("nonfinite");
    }
  }
  return {
    samples,
    msPerStep: times.reduce((a, b) => a + b) / times.length
  };
}
const rows = [];
for (const [name, opts] of configs) {
  run(opts, false);
  const runs = Array.from({
    length: 5
  }, () => run(opts, true));
  const samples = runs[0].samples;
  for (const r of runs) {
    if (JSON.stringify(r.samples) !== JSON.stringify(samples)) {
      throw Error("not deterministic");
    }
  }
  let recovery = null;
  for (let i = 600; i < 1740; i++) {
    if (samples.slice(i, i + 60).every(s => s.shapeError < 0.02)) {
      recovery = (i - 600) / 120;
      break;
    }
  }
  rows.push({
    name,
    opts,
    medianMsPerStep: runs.map(r => r.msPerStep).sort((a, b) => a - b)[2],
    maxAreaError: Math.max(...samples.map(s => s.areaError)),
    peakShapeError: Math.max(...samples.map(s => s.shapeError)),
    recoverySeconds: recovery,
    samples
  });
}
const result = {
  sourceHashes: Object.fromEntries(["physics.js", "collision.js", "scene.js"].map(f => [f, crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "../src", f))).digest("hex")])),
  environment: {
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpu: os.cpus()[0].model
  },
  protocol: "1800 steps; obstacle removed after step 599; gravity 0; one warmup and five repetitions; recovery <2% for 60 steps",
  dt: 1 / 120,
  rows
};
fs.writeFileSync(path.join(__dirname, "../results/experiment.json"), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(__dirname, "../results/summary.csv"), "name,maxAreaError,peakShapeError,recoverySeconds,medianMsPerStep\n" + rows.map(r => [r.name, r.maxAreaError, r.peakShapeError, r.recoverySeconds ?? "unreached", r.medianMsPerStep].join(",")).join("\n"));
console.log(rows.map(({
  samples,
  ...r
}) => r));
