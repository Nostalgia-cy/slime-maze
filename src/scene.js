(function(root){
const levels=[
 {name:'苔石窄门',hint:'从窄口挤过去，再绕过两道高墙。',walls:[{x:280,y:0,w:36,h:360},{x:280,y:430,w:36,h:110},{x:540,y:180,w:36,h:360},{x:730,y:0,w:36,h:360}],route:[{x:220,y:395},{x:360,y:395},{x:450,y:100},{x:630,y:100},{x:670,y:420},{x:820,y:420},{x:900,y:490}]},
 {name:'曲折回廊',hint:'穿过五道交错的门，试着保持柔软和耐心。',walls:[{x:220,y:0,w:24,h:190},{x:220,y:290,w:24,h:250},{x:360,y:180,w:24,h:360},{x:500,y:0,w:24,h:330},{x:500,y:430,w:24,h:110},{x:640,y:170,w:24,h:370},{x:780,y:0,w:24,h:300},{x:780,y:390,w:24,h:150}],route:[{x:165,y:240},{x:280,y:240},{x:305,y:100},{x:420,y:100},{x:445,y:380},{x:580,y:380},{x:585,y:85},{x:720,y:85},{x:725,y:345},{x:840,y:345},{x:900,y:490}]},
 {name:'层叠地宫',hint:'先向右寻找入口，再穿过层层回转的通道。',walls:[{x:0,y:180,w:600,h:26},{x:690,y:180,w:270,h:26},{x:0,y:310,w:270,h:26},{x:360,y:310,w:600,h:26},{x:0,y:430,w:700,h:24},{x:790,y:430,w:170,h:24}],route:[{x:645,y:115},{x:645,y:258},{x:315,y:258},{x:315,y:383},{x:745,y:383},{x:745,y:490},{x:900,y:490}]},
 {name:'双重挤压',hint:'两次挤过窄门，中途绕开石块，最后从上方绕出。',walls:[{x:250,y:0,w:32,h:210},{x:250,y:278,w:32,h:262},{x:450,y:190,w:55,h:160},{x:640,y:0,w:32,h:355},{x:640,y:423,w:32,h:117},{x:800,y:180,w:28,h:360}],route:[{x:190,y:244},{x:350,y:244},{x:360,y:410},{x:565,y:410},{x:590,y:389},{x:730,y:389},{x:735,y:100},{x:890,y:100},{x:900,y:490}]}
];
class Tour {
 constructor(level=levels[0]){this.level=level;this.index=0;this.steps=0;this.dwell=0;this.failed=false}
 get done(){return this.index>=this.level.route.length}
 target(sim){if(this.done||this.failed)return null;this.steps++;let c=sim.center(),p=this.level.route[this.index];this.dwell=Math.hypot(c.x-p.x,c.y-p.y)<12?this.dwell+1:0;if(this.dwell>=45){this.index++;this.dwell=0;this.steps=0}else if(this.steps>2400)this.failed=true;return this.done||this.failed?null:this.level.route[this.index]}
}
const api={levels,...levels[0],Tour};if(typeof module!=='undefined')module.exports=api;else root.Scene=api;
})(globalThis);
