const fs = require("fs");
const path = require("path");
const base = path.join(__dirname, "..");
// The order also supports opening the built page directly through file://.
const modules = ["scene.js", "collision.js", "physics.js", "skin.js", "ffd.js", "ui.js"];
const script = modules
  .map(name => fs.readFileSync(path.join(base, "src", name), "utf8"))
  .join("\n");
const template = fs.readFileSync(path.join(base, "src/index.html"), "utf8");
const output = template.replace("<!--SCRIPTS-->", `<script>${script}</script>`);
fs.writeFileSync(path.join(base, "dist/史莱姆穿迷宫.html"), output);
