/* Shared browser/Node core. PBD: stiffness depends on iteration count. */
(function(root){
const collision=typeof module!=="undefined"?require("../../src/collision"):root.Collision;
class Slime {
 constructor({stiffness=.35,iterations=8,recovery=true,solver="pbd",fairing=true,minEdge=true,bendLimit=true}={}){this.fairing=fairing;this.minEdge=minEdge;this.bendLimit=bendLimit;this.solver=solver;this.stiffness=stiffness;this.iterations=iterations;this.recovery=recovery;this.n=64;this.r=42;this.p=Array.from({length:this.n},(_,i)=>{let a=i*2*Math.PI/this.n,x=this.r*Math.cos(a),y=this.r*Math.sin(a);return {x:x+110,y:y+120,ox:x+110,oy:y+120,rx:x,ry:y}});this.a0=this.area();this.links=[];for(let i=0;i<this.n;i++)for(let d of [1,8]){let j=(i+d)%this.n;this.links.push([i,j,Math.hypot(this.p[i].rx-this.p[j].rx,this.p[i].ry-this.p[j].ry)])}}
 area(){return this.p.reduce((s,p,i)=>{let q=this.p[(i+1)%this.n];return s+(p.x*q.y-q.x*p.y)/2},0)}
 center(){return this.p.reduce((c,p)=>({x:c.x+p.x/this.n,y:c.y+p.y/this.n}),{x:0,y:0})}
 fit(){let c=this.center(),a=0,b=0;for(let p of this.p){a+=p.rx*(p.x-c.x)+p.ry*(p.y-c.y);b+=p.rx*(p.y-c.y)-p.ry*(p.x-c.x)}return {c,angle:Math.atan2(b,a)}}
 metrics(){let f=this.fit(),co=Math.cos(f.angle),si=Math.sin(f.angle);return {areaError:Math.abs(this.area()/this.a0-1),shapeError:Math.sqrt(this.p.reduce((s,p)=>s+(p.x-f.c.x-co*p.rx+si*p.ry)**2+(p.y-f.c.y-si*p.rx-co*p.ry)**2,0)/this.n)/this.r,distanceError:this.links.reduce((s,[i,j,l])=>s+Math.abs(Math.hypot(this.p[i].x-this.p[j].x,this.p[i].y-this.p[j].y)-l),0)/this.links.length}}
 projectArea(){
 let grads=this.p.map((p,i)=>{let a=this.p[(i+this.n-1)%this.n],b=this.p[(i+1)%this.n];return {x:(b.y-a.y)/2,y:(a.x-b.x)/2}}),den=grads.reduce((s,g)=>s+g.x*g.x+g.y*g.y,0),lambda=(this.area()-this.a0)/(den||1)*.65;this.p.forEach((p,i)=>{p.x-=lambda*grads[i].x;p.y-=lambda*grads[i].y});
 }
 regularizeContour(){
 // Curvature fairing damps local spikes; compensate the circular rest mode to avoid shrinkage.
 if(this.fairing){
 const c=this.center(),restCurvature=1-Math.cos(2*Math.PI/this.n);
 const moves=this.p.map((p,i)=>{const a=this.p[(i+this.n-1)%this.n],b=this.p[(i+1)%this.n];return {x:((a.x+b.x)/2-p.x+restCurvature*(p.x-c.x))*.5,y:((a.y+b.y)/2-p.y+restCurvature*(p.y-c.y))*.5}});
 this.p.forEach((p,i)=>{p.x+=moves[i].x;p.y+=moves[i].y});
 }
 // Prevent tiny collapsed boundary edges from becoming folded spikes.
 const minLength=2*this.r*Math.sin(Math.PI/this.n)*.6;
 if(this.minEdge)for(let i=0;i<this.n;i++){const p=this.p[i],q=this.p[(i+1)%this.n],dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);if(d<minLength){const rest=Math.atan2(q.ry-p.ry,q.rx-p.rx),nx=d>1e-8?dx/d:Math.cos(rest),ny=d>1e-8?dy/d:Math.sin(rest),amount=(minLength-d)*.5;p.x-=nx*amount;p.y-=ny*amount;q.x+=nx*amount;q.y+=ny*amount}}
 // Bound turning angles with a three-particle PBD constraint, even when shape recovery is disabled.
 if(this.bendLimit)for(let sweep=0;sweep<3;sweep++)for(let i=0;i<this.n;i++){
  const a=this.p[(i+this.n-1)%this.n],p=this.p[i],b=this.p[(i+1)%this.n],ux=p.x-a.x,uy=p.y-a.y,vx=b.x-p.x,vy=b.y-p.y;
  const u2=ux*ux+uy*uy,v2=vx*vx+vy*vy;if(u2<1e-8||v2<1e-8)continue;
  const angle=Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy);if(Math.abs(angle)<=.3)continue;
  const ga={x:-uy/u2,y:ux/u2},gb={x:-vy/v2,y:vx/v2},gp={x:-ga.x-gb.x,y:-ga.y-gb.y};
  const den=ga.x*ga.x+ga.y*ga.y+gb.x*gb.x+gb.y*gb.y+gp.x*gp.x+gp.y*gp.y;
  let lambda=-(angle-Math.sign(angle)*.3)/den;
  // Large angular errors invalidate the linear approximation; bound each local projection.
  const maxGradient=Math.max(Math.hypot(ga.x,ga.y),Math.hypot(gp.x,gp.y),Math.hypot(gb.x,gb.y));
  const maxMove=.2*Math.min(Math.sqrt(u2),Math.sqrt(v2));
  lambda*=Math.min(1,maxMove/(Math.abs(lambda)*maxGradient));
  a.x+=lambda*ga.x;a.y+=lambda*ga.y;p.x+=lambda*gp.x;p.y+=lambda*gp.y;b.x+=lambda*gb.x;b.y+=lambda*gb.y;
 }

 }
 rotationDamping(){
 // Remove most of the global angular displacement while preserving translation and local velocity differences.
 const c=this.center();let momentum=0,inertia=0;
 for(const p of this.p){const x=p.x-c.x,y=p.y-c.y;momentum+=x*(p.y-p.oy)-y*(p.x-p.ox);inertia+=x*x+y*y}
 return {c,omega:.95*momentum/(inertia||1)};
 }
 stabilizeOrientation(){
 // The character has an upright frame: bound global turning without erasing local strain.
 const {c,angle}=this.fit(),limit=15*Math.PI/180;
 const excess=angle-Math.max(-limit,Math.min(limit,angle));
 if(Math.abs(excess)<1e-10)return;
 // One gentle correction after prediction preserves local strain; the full contact solve follows.
 const correction=Math.max(-.002,Math.min(.002,-0.01*excess)),co=Math.cos(correction),si=Math.sin(correction);
 for(const p of this.p){const x=p.x-c.x,y=p.y-c.y;p.x=c.x+co*x-si*y;p.y=c.y+si*x+co*y}
 }
 step({target=null,obstacles=[],gravity=650}={}){let dt=1/120;
 const forces=this.p.map(()=>({x:0,y:0}));
 // Lecture6 p22-24: Hooke force plus pairwise velocity damping, unit mass.
 if(this.solver==='spring')for(let [i,j,l] of this.links){let p=this.p[i],q=this.p[j],dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d,relative=((q.x-q.ox-p.x+p.ox)*nx+(q.y-q.oy-p.y+p.oy)*ny)/dt,f=(150+2000*this.stiffness)*(d-l)+7*relative;forces[i].x+=f*nx;forces[i].y+=f*ny;forces[j].x-=f*nx;forces[j].y-=f*ny}
 const {c:sc,omega}=this.rotationDamping();
 for(let i=0;i<this.n;i++){let p=this.p[i];let vx=Math.max(-3,Math.min(3,(p.x-p.ox+omega*(p.y-sc.y))*.985)),vy=Math.max(-3,Math.min(3,(p.y-p.oy-omega*(p.x-sc.x))*.985));p.ox=p.x;p.oy=p.y;p.x+=vx+forces[i].x*dt*dt;p.y+=vy+(gravity+forces[i].y)*dt*dt}
 this.stabilizeOrientation();
 for(let k=0;k<this.iterations;k++){

 if(this.solver==='pbd')for(let [i,j,l] of this.links){let p=this.p[i],q=this.p[j],x=q.x-p.x,y=q.y-p.y,d=Math.hypot(x,y)||1,t=(d-l)/d*this.stiffness*.5;p.x+=x*t;p.y+=y*t;q.x-=x*t;q.y-=y*t}
 this.regularizeContour();
 this.projectArea();
 
 if(this.recovery){const materialRecovery=.012;let {c,angle}=this.fit(),co=Math.cos(angle),si=Math.sin(angle);for(let p of this.p){p.x+=(c.x+co*p.rx-si*p.ry-p.x)*materialRecovery;p.y+=(c.y+si*p.rx+co*p.ry-p.y)*materialRecovery}}
 if(target){let c=this.center(),dx=Math.max(-2,Math.min(2,(target.x-c.x)*.025)),dy=Math.max(-2,Math.min(2,(target.y-c.y)*.025));for(let p of this.p){p.x+=dx/this.iterations;p.y+=dy/this.iterations}}
 collision.resolve(this.p,obstacles);
 }
 // Finish with contacts, so later structural corrections cannot reintroduce visible penetration.
 for(let pass=0;pass<6;pass++){this.regularizeContour();this.projectArea();collision.resolve(this.p,obstacles,8)}
 collision.resolve(this.p,obstacles,12);
 }
}
if(typeof module!=='undefined')module.exports=Slime;else root.Slime=Slime;
})(globalThis);
