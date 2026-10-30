const assert=require('node:assert/strict'),Slime=require('../src/physics'),Scene=require('../src/scene');
for(const solver of ['pbd','spring'])for(const stiffness of [.05,.9]){
 const s=new Slime({solver,stiffness});for(let i=0;i<600;i++)s.step({target:{x:305,y:220},obstacles:Scene.walls});
 const state=JSON.stringify(s.p),particles=s.p;s.solver=solver==='pbd'?'spring':'pbd';assert.equal(JSON.stringify(s.p),state);assert.equal(s.p,particles);
 let maxDisplacement=0;for(let i=0;i<180;i++){const previous=s.p.map(p=>({x:p.x,y:p.y}));s.step({target:{x:305,y:220},obstacles:Scene.walls});for(let j=0;j<s.n;j++)maxDisplacement=Math.max(maxDisplacement,Math.hypot(s.p[j].x-previous[j].x,s.p[j].y-previous[j].y));assert(s.p.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))}assert(maxDisplacement<12);console.log(solver+' -> '+s.solver,{stiffness,maxParticleDisplacementPerStep:maxDisplacement});
}
