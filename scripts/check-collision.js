const assert = require("node:assert/strict");
const C = require("../src/collision");
const r = {
  x: 10,
  y: 10,
  w: 20,
  h: 20
};
assert(C.segmentInterior({
  x: 0,
  y: 20
}, {
  x: 40,
  y: 20
}, r));
assert(C.segmentInterior({
  x: 0,
  y: 0
}, {
  x: 40,
  y: 40
}, r));
assert(!C.segmentInterior({
  x: 0,
  y: 10
}, {
  x: 40,
  y: 10
}, r));
assert(!C.segmentInterior({
  x: 0,
  y: 0
}, {
  x: 10,
  y: 10
}, r));
assert(!C.segmentInterior({
  x: 0,
  y: 0
}, {
  x: 0,
  y: 40
}, r));
assert(C.segmentInterior({
  x: 20,
  y: 20
}, {
  x: 20,
  y: 20
}, r));
for (let i = 0; i < 100; i++) {
  const x = 11 + i * 0.18;
  const p = {
    x,
    y: 20
  };
  const d = C.projectInside(p, r);
  assert(d);
  assert(!C.projectInside({
    x: p.x + d.x,
    y: p.y + d.y
  }, r));
}
console.log("线段穿越、斜交、相切、端点接触、平行、退化线段、内部投影检查通过");
