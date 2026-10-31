const assert = require("node:assert/strict");
const FFD = require("../src/ffd");
const Slime = require("../src/physics");
const near = (a, b, tol = 1e-8) => assert(Math.abs(a - b) < tol, `${a} != ${b}`);
const f = new FFD();
for (let i = 0; i <= 20; i++) {
  for (let j = 0; j <= 20; j++) {
    const u = i / 20;
    const v = j / 20;
    const p = f.evaluate(u, v);
    near(p.x, 330 + 300 * u);
    near(p.y, 110 + 300 * v);
    near(f.basis(u).reduce((a, b) => a + b), 1);
    near(f.jacobian(u, v), 1);
  }
}
const original = f.evaluate(0.21, 0.77);
for (const p of f.controls) {
  p.x += 37;
  p.y -= 18;
}
const moved = f.evaluate(0.21, 0.77);
near(moved.x, original.x + 37);
near(moved.y, original.y - 18);
f.reset();
const area = f.metrics().areaRatio;
for (const preset of ["squash", "stretch"]) {
  f.preset(preset);
  near(f.metrics().areaRatio, area);
  near(f.metrics().minJacobian, 1);
}
f.reset();
f.controls[5].x += 50;
assert(f.evaluate(0.35, 0.35).x > 435); // Interior handle affects interior geometry.
for (const p of f.controls) {
  p.x = 960 - p.x;
}

assert(f.metrics().minJacobian < 0);
console.log("FFD: 恒等、基函数单位和、平移、面积保持预设、局部影响、折叠诊断通过");
for (const solver of ["spring", "pbd"]) {
  for (const stiffness of [0.05, 0.35, 0.9]) {
    const s = new Slime({
      solver,
      stiffness
    });
    for (let i = 0; i < 12000; i++) {
      s.step();
      assert(s.p.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    }

    assert(s.metrics().areaError < 0.08);
    console.log(solver, stiffness, "100秒稳定", s.metrics());
  }
}
// Disable global recovery: stretched pairs must contract due to spring forces alone.
const s = new Slime({
  solver: "spring",
  recovery: false
});
for (const p of s.p) {
  p.x = 110 + (p.x - 110) * 1.3;
  p.y = 120 + (p.y - 120) / 1.3;
  p.ox = p.x;
  p.oy = p.y;
}
const before = s.metrics().distanceError;
for (let i = 0; i < 1200; i++) {
  s.step({
    gravity: 0
  });
}

assert(s.metrics().distanceError < before * 0.1);
console.log("关闭全局恢复后的弹簧复原通过", before, s.metrics().distanceError);
for (let time = 0; time < 3; time += 0.01) {
  f.pose(time);
  near(f.metrics().areaRatio, area);
  near(f.metrics().minJacobian, 1);
}
console.log("FFD 关键姿态插值全时段保持面积通过");
