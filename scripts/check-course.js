const assert=require('node:assert/strict'),FFD=require('../src/ffd'),Slime=require('../src/physics');
const near=(a,b,tol=1e-8)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
let f=new FFD();
for(let i=0;i<=20;i++)for(let j=0;j<=20;j++){let u=i/20,v=j/20,p=f.evaluate(u,v);near(p.x,330+300*u);near(p.y,110+300*v);near(f.basis(u).reduce((a,b)=>a+b),1);near(f.jacobian(u,v),1)}
const original=f.evaluate(.21,.77);for(let p of f.controls){p.x+=37;p.y-=18}let moved=f.evaluate(.21,.77);near(moved.x,original.x+37);near(moved.y,original.y-18);
f.reset();let area=f.metrics().areaRatio;for(let preset of ['squash','stretch']){f.preset(preset);near(f.metrics().areaRatio,area);near(f.metrics().minJacobian,1)}
f.reset();f.controls[5].x+=50;assert(f.evaluate(.35,.35).x>435); // Interior handle affects interior geometry.
for(let p of f.controls)p.x=960-p.x;assert(f.metrics().minJacobian<0);console.log('FFD: 恒等、基函数单位和、平移、面积保持预设、局部影响、折叠诊断通过');
for(let solver of ['spring','pbd'])for(let stiffness of [.05,.35,.9]){let s=new Slime({solver,stiffness});for(let i=0;i<12000;i++){s.step();assert(s.p.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}assert(s.metrics().areaError<.08);console.log(solver,stiffness,'100秒稳定',s.metrics())}
// Disable global recovery: stretched pairs must contract due to spring forces alone.
let s=new Slime({solver:'spring',recovery:false});for(let p of s.p){p.x=110+(p.x-110)*1.3;p.y=120+(p.y-120)/1.3;p.ox=p.x;p.oy=p.y}let before=s.metrics().distanceError;for(let i=0;i<1200;i++)s.step({gravity:0});assert(s.metrics().distanceError<before*.1);console.log('关闭全局恢复后的弹簧复原通过',before,s.metrics().distanceError);
for(let time=0;time<3;time+=.01){f.pose(time);near(f.metrics().areaRatio,area);near(f.metrics().minJacobian,1)}
console.log('FFD 关键姿态插值全时段保持面积通过');
