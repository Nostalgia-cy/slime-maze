const {spawnSync}=require('node:child_process'),path=require('node:path');
for(const file of ['check.js','check-collision.js','check-ablation.js','check-contour.js','check-switch.js','check-skin.js','check-ui.js']){const r=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1)}
