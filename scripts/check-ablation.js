const assert=require('node:assert/strict'),Slime=require('../src/physics');
const opts={fairing:false,minEdge:false,bendLimit:false},copy=s=>JSON.stringify(s.p);
let s=new Slime(opts);s.p[0].x+=14;const before=copy(s);s.regularizeContour();assert.equal(copy(s),before);
function roughness(s){return s.p.reduce((sum,p,i)=>{let a=s.p[(i+s.n-1)%s.n],b=s.p[(i+1)%s.n];return sum+((a.x+b.x)/2-p.x)**2+((a.y+b.y)/2-p.y)**2},0)}
s=new Slime({...opts,fairing:true});s.p[0].x+=14;let rough=roughness(s),center=s.center();s.regularizeContour();assert(roughness(s)<rough);assert(Math.hypot(s.center().x-center.x,s.center().y-center.y)<1e-8);
s=new Slime({...opts,minEdge:true});s.p[1].x=s.p[0].x;s.p[1].y=s.p[0].y;s.regularizeContour();assert(Math.hypot(s.p[1].x-s.p[0].x,s.p[1].y-s.p[0].y)>1e-6);
function maxTurn(s){return Math.max(...s.p.map((p,i)=>{let a=s.p[(i+s.n-1)%s.n],b=s.p[(i+1)%s.n],ux=p.x-a.x,uy=p.y-a.y,vx=b.x-p.x,vy=b.y-p.y;return Math.abs(Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy))}))}
s=new Slime({...opts,bendLimit:true});s.p[0].x+=14;const turn=maxTurn(s);s.regularizeContour();assert(maxTurn(s)<turn);for(let i=0;i<100;i++)s.regularizeContour();assert(s.p.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
console.log('消融开关独立性、局部平滑、质心保持、短边分离与弯折修正检查通过');
