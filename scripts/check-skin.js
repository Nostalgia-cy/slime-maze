const assert = require('node:assert/strict');
const Slime = require('../src/physics');
const SoftBodySkin = require('../src/skin');
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const sim = new Slime();
const skin = new SoftBodySkin(sim.p);
const samples = [[.44, .48], [.56, .48], [.5, .56], [.42, .34], [.62, .65]];
for (const [u, v] of samples) {
  const weights = skin.weights(u, v);
  near(weights.reduce((sum, w) => sum + w, 0), 1);
  assert(weights.every(w => w >= 0));
  const p = skin.sample(sim.p, u, v);
  near(p.x, 110 + (u - .5) * 180);
  near(p.y, 120 + (v - .5) * 180);
  assert.equal(skin.weights(u, v), weights);
}

// A material point must follow affine squash, shear, rotation and translation exactly.
for (const [a, b, c, d] of [[1.6, 0, 0, .625], [1, .4, 0, 1], [0, -1, 1, 0]]) {
  const points = sim.p.map(p => ({
    x: 300 + a * p.rx + b * p.ry,
    y: 240 + c * p.rx + d * p.ry
  }));
  for (const [u, v] of samples) {
    const p = skin.sample(points, u, v),
      x = (u - .5) * 180,
      y = (v - .5) * 180;
    near(p.x, 300 + a * x + b * y);
    near(p.y, 240 + c * x + d * y);
  }
}

// A local bulge with zero centroid displacement still moves nearby artwork.
const bulged = sim.p.map(p => ({
  ...p
}));
bulged[0].x += 10;
bulged[32].x -= 10;
const before = skin.sample(sim.p, .62, .5),
  after = skin.sample(bulged, .62, .5);
assert(after.x > before.x + .1);
const unchanged = JSON.stringify(sim.p);
for (const [u, v] of samples) skin.sample(sim.p, u, v);
assert.equal(JSON.stringify(sim.p), unchanged);

// Actual wall pressure in both solvers must keep every artwork sample finite.
for (const solver of ['pbd', 'spring']) {
  const s = new Slime({
    solver,
    stiffness: .05
  });
  for (let i = 0; i < 1200; i++) {
    s.step({
      target: {
        x: 350,
        y: 210
      },
      obstacles: [{
        x: 280,
        y: 0,
        w: 36,
        h: 360
      }]
    });
    if (i % 12 === 0) for (const [u, v] of samples) {
      const p = skin.sample(s.p, u, v);
      assert(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
  }
}
console.log('材质坐标绑定：恒等、权重、仿射形变、局部形变、无状态修改与两模型挤压检查通过。');
