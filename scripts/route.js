const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Slime=require('../src/physics'),Scene=require('../src/scene'),Collision=require('../src/collision');
const rows=[];
for(const level of Scene.levels)for(let solver of ['pbd','spring'])for(const stiffness of [.05,.35,.9]){
 const s=new Slime({solver,stiffness}),tour=new Scene.Tour(level);let maxDepth=0,crossingSteps=0,peakArea=0,steps=0,samples=[];
 while(!tour.done&&!tour.failed&&steps<20000){s.step({target:tour.target(s),obstacles:level.walls});const c=Collision.metrics(s.p,level.walls);maxDepth=Math.max(maxDepth,c.maxDepth);if(c.edgeCrossings)crossingSteps++;peakArea=Math.max(peakArea,s.metrics().areaError);if(steps%12===0)samples.push({step:steps,center:s.center(),...s.metrics(),...c});steps++}
 assert(tour.done,solver+' route failed');assert(s.p.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));const row={level:level.name,solver,stiffness,steps,seconds:steps/120,center:s.center(),maxDepth,crossingSteps,peakArea,samples};rows.push(row);console.log({...row,samples:undefined});
}
fs.writeFileSync(path.join(__dirname,'../results/route.json'),JSON.stringify(rows,null,2));
