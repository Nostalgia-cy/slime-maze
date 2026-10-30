const fs = require('fs'),
  path = require('path'),
  base = path.join(__dirname, '..');
const script = ['scene.js', 'collision.js', 'physics.js', 'skin.js', 'ffd.js', 'ui.js'].map(f => fs.readFileSync(path.join(base, 'src', f), 'utf8')).join('\n');
fs.writeFileSync(path.join(base, 'dist/史莱姆穿迷宫.html'), fs.readFileSync(path.join(base, 'src/index.html'), 'utf8').replace('<!--SCRIPTS-->', `<script>${script}</script>`));
