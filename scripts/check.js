const assert = require("assert/strict");
const Slime = require("../src/physics");
for (const iterations of [2, 8, 16]) {
  const s = new Slime({
    iterations
  });
  for (let i = 0; i < 12000; i++) {
    s.step();
    assert(s.p.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y <= 532 && p.x >= 8 && p.x <= 952));
  }

  assert(s.metrics().areaError < 0.08);
  console.log("静置 100 秒通过", iterations, s.metrics());
}
const s = new Slime();
for (let i = 0; i < 1200; i++) {
  s.step({
    gravity: 0
  });
}

assert(s.metrics().shapeError < 1e-8);
console.log("无外力静止形状通过");
