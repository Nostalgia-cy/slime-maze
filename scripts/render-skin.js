const {
  createCanvas,
  GlobalFonts
} = require("@napi-rs/canvas");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.join(__dirname, "..");
if (fs.existsSync("/System/Library/Fonts/STHeiti Medium.ttc")) {
  GlobalFonts.registerFromPath("/System/Library/Fonts/STHeiti Medium.ttc", "Preview Chinese");
}
const output = createCanvas(1000, 780);
const out = output.getContext("2d");
out.fillStyle = "#0d1e29";
out.fillRect(0, 0, 1000, 780);
out.fillStyle = "#d6f2df";
out.font = "22px sans-serif";
out.fillText("Facial details bound to the deforming contour", 28, 35);
out.font = "16px sans-serif";
out.fillStyle = "#a4b9b5";
out.fillText("Same body geometry | offscreen Canvas, not browser screenshots", 28, 63);
for (let column = 0; column < 2; column++) {
  const cell = createCanvas(480, 210);
  const ctx = cell.getContext("2d");
  let scheduled;
  const elements = {};
  const ids = ["completion", "completionTitle", "completionText", "completionStep", "advance", "retry", "progress1", "progress2", "progress3", "progress4", "stageTitle", "stageNumber", "stageState", "levelDescription", "helpTitle", "levelControls", "tour", "record", "notice", "noticeWrap", "recordingDownload", "performanceStats", "canvas", "soft", "recover", "solver", "maze", "studio", "physicsControls", "ffdControls", "hint", "reset", "pause", "keys", "status", "debug"];
  for (const id of ids) {
    elements[id] = {
      value: id === "soft" ? ".35" : id === "solver" ? "pbd" : "",
      checked: id === "recover",
      hidden: true,
      classList: {
        toggle() {}
      },
      dataset: {},
      setAttribute() {},
      open: false,
      close() {
        this.open = false;
      },
      showModal() {
        this.open = true;
      }
    };
  }
  elements.canvas.getContext = () => ctx;
  const context = vm.createContext({
    document: {
      querySelector: s => elements[s.replace("#", "")],
      querySelectorAll: () => []
    },
    window: {
      addEventListener() {}
    },
    requestAnimationFrame: fn => scheduled = fn,
    performance
  });
  for (const f of ["scene.js", "collision.js", "physics.js", "skin.js", "ffd.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "src", f), "utf8"), context);
  }
  vm.runInContext(fs.readFileSync(path.join(root, "src/ui.js"), "utf8"), context);
  if (!column) {
    vm.runInContext("body=" + legacyBody.toString(), context);
  }
  out.fillStyle = "#e0eddf";
  out.font = "18px sans-serif";
  out.fillText(column ? "AFTER / bound material coordinates" : "BEFORE / centroid translation only", column * 500 + 24, 102);
  for (let row = 0; row < 3; row++) {
    const cases = [[1.6, 0.625, 0], [0.65, 1.3, 0], [1.4, 0.65, 0.85]];
    const [sx, sy, angle] = cases[row];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#142b36";
    ctx.fillRect(0, 0, 480, 210);
    ctx.translate(240, 112);
    ctx.scale(1.65, 1.65);
    ctx.translate(-480, -270);
    vm.runInContext(`{const co=Math.cos(${angle}),si=Math.sin(${angle});for(const p of sim.p){p.x=480+co*p.rx*${sx}-si*p.ry*${sy};p.y=270+si*p.rx*${sx}+co*p.ry*${sy}}body(sim.p,${column ? "(u,v)=>skin.sample(sim.p,u,v)" : "(u,v)=>({x:480+(u-.5)*180,y:270+(v-.5)*180})"})}`, context);
    out.drawImage(cell, column * 500 + 10, 120 + row * 215);
    out.fillStyle = "#99b3b2";
    out.font = "13px sans-serif";
    out.fillText(["Squash", "Stretch", "Rotate + squash"][row], column * 500 + 25, 141 + row * 215);
  }
}
const file = path.join(root, "results/skin-comparison.png");
fs.writeFileSync(file, output.toBuffer("image/png"));
console.log(file);

// Retain the former drawing only for this before/after illustration.
function legacyBody(points, face) {
  path(points);
  const g = ctx.createLinearGradient(0, Math.min(...points.map(p => p.y)), 0, Math.max(...points.map(p => p.y)));
  g.addColorStop(0, "#b4f8c7");
  g.addColorStop(1, "#36b6a0");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#d2ffe1";
  ctx.stroke();
  ctx.save();
  ctx.clip();
  // Sample the face in material coordinates so the FFD face follows local deformation.
  const shine = face(0.42, 0.34);
  ctx.fillStyle = "rgba(236,255,235,.48)";
  ctx.beginPath();
  ctx.ellipse(shine.x, shine.y, Math.max(5, (Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))) * 0.12), 4, -0.4, 0, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(224,255,229,.2)";
  for (const [u, v] of [[0.62, 0.65], [0.36, 0.58], [0.58, 0.31]]) {
    const p = face(u, v);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = "#173e3d";
  for (const u of [0.44, 0.56]) {
    const eye = Array.from({
      length: 24
    }, (_, i) => {
      const a = i * Math.PI / 12;
      return face(u + 0.014 * Math.cos(a), 0.48 + 0.024 * Math.sin(a));
    });
    path(eye);
    ctx.fill();
  }
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = i * Math.PI / 24;
    const p = face(0.5 + 0.04 * Math.cos(a), 0.54 + 0.025 * Math.sin(a));
    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
  }
  ctx.strokeStyle = "#173e3d";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}
