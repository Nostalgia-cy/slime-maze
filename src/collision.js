(function(root){
// Clip a segment against the open interior of an axis-aligned rectangle.
function segmentInterior(a,b,r){
 const epsilon=1e-7;let enter=0,exit=1;
 for(const [axis,lo,hi] of [['x',r.x+epsilon,r.x+r.w-epsilon],['y',r.y+epsilon,r.y+r.h-epsilon]]){
  const delta=b[axis]-a[axis];
  if(Math.abs(delta)<1e-12){if(a[axis]<lo||a[axis]>hi)return null;continue}
  let t0=(lo-a[axis])/delta,t1=(hi-a[axis])/delta;if(t0>t1)[t0,t1]=[t1,t0];
  enter=Math.max(enter,t0);exit=Math.min(exit,t1);if(enter>=exit)return null;
 }
 const t=(enter+exit)/2;return {enter,exit,t,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
function projectInside(p,r){
 if(p.x<=r.x||p.x>=r.x+r.w||p.y<=r.y||p.y>=r.y+r.h)return null;
 const depths=[p.x-r.x,r.x+r.w-p.x,p.y-r.y,r.y+r.h-p.y],side=depths.indexOf(Math.min(...depths));
 return {x:side===0?-depths[0]:side===1?depths[1]:0,y:side===2?-depths[2]:side===3?depths[3]:0};
}
function metrics(points,rects){let maxDepth=0,edgeCrossings=0;for(let i=0;i<points.length;i++)for(const r of rects){let hit=segmentInterior(points[i],points[(i+1)%points.length],r);if(hit){edgeCrossings++;let correction=projectInside(hit,r);if(correction)maxDepth=Math.max(maxDepth,Math.hypot(correction.x,correction.y))}}return {maxDepth,edgeCrossings}}
function resolve(points,rects,passes=1){
 for(let pass=0;pass<passes;pass++){
  for(const p of points){p.x=Math.max(8,Math.min(952,p.x));p.y=Math.max(8,Math.min(532,p.y));for(const r of rects){const d=projectInside(p,r);if(d){p.x+=d.x;p.y+=d.y}}}
  for(let i=0;i<points.length;i++)for(const r of rects){let p=points[i],q=points[(i+1)%points.length],hit=segmentInterior(p,q,r);if(!hit)continue;let d=projectInside(hit,r);if(!d)continue;const t=hit.t,den=(1-t)**2+t*t;p.x+=d.x*(1-t)/den;p.y+=d.y*(1-t)/den;q.x+=d.x*t/den;q.y+=d.y*t/den}
 }
}
const api={segmentInterior,projectInside,metrics,resolve};if(typeof module!=='undefined')module.exports=api;else root.Collision=api;
})(globalThis);
