const {
  spawnSync
} = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

for (const directory of ["src", "scripts"]) {
  const base = path.join(__dirname, "..", directory);
  for (const name of fs.readdirSync(base).filter(name => name.endsWith(".js"))) {
    const result = spawnSync(process.execPath, ["--check", path.join(base, name)], { stdio: "inherit" });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}
for (const file of ["check.js", "check-course.js", "check-collision.js", "check-ablation.js", "check-contour.js", "check-switch.js", "check-skin.js", "check-upright.js", "check-ui.js"]) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: "inherit"
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
