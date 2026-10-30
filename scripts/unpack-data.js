const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(p.endsWith('.json.gz'))fs.writeFileSync(p.slice(0,-3),zlib.gunzipSync(fs.readFileSync(p)))}}
walk(path.join(__dirname,'../results'));console.log('Raw JSON experiment data restored.');
