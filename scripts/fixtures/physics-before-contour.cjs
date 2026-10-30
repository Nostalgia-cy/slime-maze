/* Shared browser/Node core. PBD: stiffness depends on iteration count. */
(function(root){
const collision=typeof module!=="undefined"?require("../../src/collision"):root.Collision;
class Slime {
 constructor({stiffness=.35,iterations=8,recovery=true,solver="pbd"}={}){this.solver=solver;this.stiffness=stiffness;this.iterations=iterations;this.recovery=recovery;this.n=32;this.r=42;this.p=Array.from({length:this.n},(_,i)=>{let a=i*2*Math.PI/this.n,x=this.r*Math.cos(a),y=this.r*Math.sin(a);return {x:x+110,y:y+120,ox:x+110,oy:y+120,rx:x,ry:y}});this.a0=this.area();this.links=[];for(let i=0;i<this.n;i++)for(let d of [1,4]){let j=(i+d)%this.n;this.links.push([i,j,Math.hypot(this.p[i].rx-this.p[j].rx,this.p[i].ry-this.p[j].ry)])}}
 area(){return this.p.reduce((s,p,i)=>{let q=this.p[(i+1)%this.n];return s+(p.x*q.y-q.x*p.y)/2},0)}
 center(){return this.p.reduce((c,p)=>({x:c.x+p.x/this.n,y:c.y+p.y/this.n}),{x:0,y:0})}
 fit(){let c=this.center(),a=0,b=0;for(let p of this.p){a+=p.rx*(p.x-c.x)+p.ry*(p.y-c.y);b+=p.rx*(p.y-c.y)-p.ry*(p.x-c.x)}return {c,angle:Math.atan2(b,a)}}
 metrics(){let f=this.fit(),co=Math.cos(f.angle),si=Math.sin(f.angle);return {areaError:Math.abs(this.area()/this.a0-1),shapeError:Math.sqrt(this.p.reduce((s,p)=>s+(p.x-f.c.x-co*p.rx+si*p.ry)**2+(p.y-f.c.y-si*p.rx-co*p.ry)**2,0)/this.n)/this.r,distanceError:this.links.reduce((s,[i,j,l])=>s+Math.abs(Math.hypot(this.p[i].x-this.p[j].x,this.p[i].y-this.p[j].y)-l),0)/this.links.length}}
 step({target=null,obstacles=[],gravity=650}={}){let dt=1/120;
 const forces=this.p.map(()=>({x:0,y:0}));
 // Lecture6 p22-24: Hooke force plus pairwise velocity damping, unit mass.
 if(this.solver==='spring')for(let [i,j,l] of this.links){let p=this.p[i],q=this.p[j],dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d,relative=((q.x-q.ox-p.x+p.ox)*nx+(q.y-q.oy-p.y+p.oy)*ny)/dt,f=(150+2000*this.stiffness)*(d-l)+7*relative;forces[i].x+=f*nx;forces[i].y+=f*ny;forces[j].x-=f*nx;forces[j].y-=f*ny}
 for(let i=0;i<this.n;i++){let p=this.p[i];let vx=Math.max(-3,Math.min(3,(p.x-p.ox)*.985)),vy=Math.max(-3,Math.min(3,(p.y-p.oy)*.985));p.ox=p.x;p.oy=p.y;p.x+=vx+forces[i].x*dt*dt;p.y+=vy+(gravity+forces[i].y)*dt*dt}
 for(let k=0;k<this.iterations;k++){

 if(this.solver==='pbd')for(let [i,j,l] of this.links){let p=this.p[i],q=this.p[j],x=q.x-p.x,y=q.y-p.y,d=Math.hypot(x,y)||1,t=(d-l)/d*this.stiffness*.5;p.x+=x*t;p.y+=y*t;q.x-=x*t;q.y-=y*t}
 let grads=this.p.map((p,i)=>{let a=this.p[(i+this.n-1)%this.n],b=this.p[(i+1)%this.n];return {x:(b.y-a.y)/2,y:(a.x-b.x)/2}}),den=grads.reduce((s,g)=>s+g.x*g.x+g.y*g.y,0),lambda=(this.area()-this.a0)/(den||1)*.65;this.p.forEach((p,i)=>{p.x-=lambda*grads[i].x;p.y-=lambda*grads[i].y});
 if(this.recovery){let {c,angle}=this.fit(),co=Math.cos(angle),si=Math.sin(angle);for(let p of this.p){p.x+=(c.x+co*p.rx-si*p.ry-p.x)*.012;p.y+=(c.y+si*p.rx+co*p.ry-p.y)*.012}}
 if(target){let c=this.center(),dx=Math.max(-2,Math.min(2,(target.x-c.x)*.025)),dy=Math.max(-2,Math.min(2,(target.y-c.y)*.025));for(let p of this.p){p.x+=dx/this.iterations;p.y+=dy/this.iterations}}
 collision.resolve(this.p,obstacles);
 }
 // Finish with contacts, so later structural corrections cannot reintroduce visible penetration.
 collision.resolve(this.p,obstacles,8);
 }
}
if(typeof module!=='undefined')module.exports=Slime;else root.Slime=Slime;
})(globalThis);
