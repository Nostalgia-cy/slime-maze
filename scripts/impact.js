const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const baseline = process.argv.includes("--baseline");
const Slime = require(baseline ? "./fixtures/physics-fixed-recovery.cjs" : "../src/physics");
const rows = [];
for (const solver of ["pbd", "spring"]) {
  for (const stiffness of [0.05, 0.35, 0.9]) {
    const s = new Slime({
      solver,
      stiffness
    });
    const c = s.center();
    for (const p of s.p) {
      p.x += 480 - c.x;
      p.y += 100 - c.y;
      p.ox = p.x;
      p.oy = p.y;
    }
    let contact = -1;
    let minHeight = 84;
    let maxWidth = 84;
    let maxShape = 0;
    let peakArea = 0;
    let compressionFrame = null;
    const samples = [];
    for (let step = 0; step < 900; step++) {
      s.step();
      const xs = s.p.map(p => p.x);
      const ys = s.p.map(p => p.y);
      const height = Math.max(...ys) - Math.min(...ys);
      const width = Math.max(...xs) - Math.min(...xs);
      const m = s.metrics();
      if (contact < 0 && Math.max(...ys) > 531.99) {
        contact = step;
      }
      if (contact >= 0 && step < contact + 180) {
        if (height < minHeight) {
          minHeight = height;
          compressionFrame = s.p.map(p => ({
            x: p.x,
            y: p.y
          }));
        }
        maxWidth = Math.max(maxWidth, width);
        maxShape = Math.max(maxShape, m.shapeError);
        peakArea = Math.max(peakArea, m.areaError);
      }
      if (step % 3 === 0) {
        samples.push({
          step,
          time: (step + 1) / 120,
          height,
          width,
          ...m
        });
      }
    }

    assert(contact >= 0);
    rows.push({
      solver,
      stiffness,
      contactStep: contact,
      minHeight,
      maxWidth,
      maxShape,
      peakArea,
      compressionFrame,
      samples
    });
  }
}
if (!baseline) {
  for (const solver of ["pbd", "spring"]) {
    const r = rows.filter(r => r.solver === solver);
    assert(r[2].minHeight - r[0].minHeight > 12);
    assert(r[0].maxWidth - r[2].maxWidth > 15);
    assert(r[0].maxShape > r[2].maxShape * 3);
    assert(r.every(x => x.peakArea < 0.05));
  }
}
fs.mkdirSync(path.join(__dirname, "../results/depth-study"), {
  recursive: true
});
fs.writeFileSync(path.join(__dirname, "../results/depth-study", baseline ? "impact-before.json" : "impact.json"), JSON.stringify({
  protocol: "same mass/radius/initial center (480,100), gravity 650, dt 1/120; floor y=532; evaluate first 180 steps after first contact; global recovery enabled",
  rows
}, null, 2));
console.log(rows.map(({
  samples,
  compressionFrame,
  ...r
}) => r));
