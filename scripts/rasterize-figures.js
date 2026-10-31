// Optional PNG export after study-figures.py; not required by the offline app.
const {
  createCanvas,
  loadImage
} = require("@napi-rs/canvas");
const fs = require("node:fs");
const path = require("node:path");
async function main() {
  const base = path.join(__dirname, "../results/depth-study");
  for (const name of ["ablation-turn", "gap-pass", "impact-response"]) {
    const image = await loadImage(path.join(base, name + ".svg"));
    const canvas = createCanvas(Math.round(image.width * 1.5), Math.round(image.height * 1.5));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    fs.writeFileSync(path.join(base, name + ".png"), canvas.toBuffer("image/png"));
  }
  console.log("Three PNG study figures generated from the current SVGs.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
