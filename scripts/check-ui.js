// UI state and event checks; this is not a real browser layout test.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
let scheduled,drawCalls=0,rect={left:0,top:0,width:960,height:540};const gradient={addColorStop(){}};
const ctx=new Proxy({createLinearGradient(){return gradient},createRadialGradient(){return gradient}}, {get(o,k){if(k in o)return o[k];return ()=>drawCalls++},set(o,k,v){o[k]=v;return true}});
const ids=['completion','completionTitle','completionText','completionStep','advance','retry','progress1','progress2','progress3','progress4','stageTitle','stageNumber','stageState','levelDescription','helpTitle','levelControls','tour','record','notice','canvas','soft','recover','solver','maze','studio','physicsControls','ffdControls','hint','reset','pause','keys','status','debug'];
const els={};for(const id of ids)els[id]={value:id==='soft'?'.35':id==='solver'?'pbd':'',checked:id==='recover',classList:{toggle(){}},dataset:{},setAttribute(k,v){this[k]=v},focus(){},showModal(){this.open=true},close(){this.open=false},open:false,hidden:false};
Object.assign(els.canvas,{getContext:()=>ctx,setPointerCapture(){},getBoundingClientRect:()=>rect});
const context=vm.createContext({document:{querySelector:s=>{const el=els[s.replace('#','')];assert(el,'missing '+s);return el},querySelectorAll:()=>[]},window:{addEventListener(){}},requestAnimationFrame:fn=>scheduled=fn});
for(const f of ['scene.js','collision.js','physics.js','ffd.js','ui.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f),'utf8'),context);
let time=0;const frame=()=>scheduled(time+=16);
frame();assert(drawCalls>0);assert.equal(els.stageTitle.textContent,'苔石窄门');assert(!els.completion.open);
els.advance.onclick();frame();assert.equal(els.stageNumber.textContent,'01');
els.studio.onclick();frame();assert(els.physicsControls.hidden);assert.equal(els.stageTitle.textContent,'捏捏工作台');assert.equal(els.studio['aria-pressed'],'true');els.keys.onclick();frame();assert.equal(els.stageState.textContent,'播放中');els.maze.onclick();
// Switching solvers must preserve the same particles, implicit velocities, and campaign state.
vm.runInContext('{const c=sim.center();for(let i=0;i<sim.p.length;i++){const p=sim.p[i];p.x+=200;p.y+=50;if(i%4===0)p.x+=2}}',context);
const switchState=vm.runInContext('JSON.stringify({particles:sim.p,level:Scene.levels.indexOf(level),won,paused})',context);
for(const value of ['spring','pbd','spring']){els.solver.value=value;els.solver.onchange({target:els.solver});assert.equal(vm.runInContext('sim.solver',context),value);assert.equal(vm.runInContext('JSON.stringify({particles:sim.p,level:Scene.levels.indexOf(level),won,paused})',context),switchState)}
els.reset.onclick();
// The canvas can be letterboxed by the viewport; pointer mapping must use the displayed image.
rect={left:0,top:0,width:480,height:540};els.canvas.onpointerdown({pointerId:1,clientX:120,clientY:195});assert.equal(vm.runInContext('drag.x',context),240);assert.equal(vm.runInContext('drag.y',context),120);els.canvas.onpointerup();els.canvas.onpointerdown({pointerId:1,clientX:100,clientY:20});assert.equal(vm.runInContext('drag',context),null);rect={left:0,top:0,width:960,height:540};
els.pause.onclick();frame();assert.equal(els.stageState.textContent,'已暂停');els.pause.onclick();
// One real scripted tour must open completion, rather than merely changing a status label.
els.tour.onclick();for(let i=0;i<400&&!els.completion.open;i++)scheduled(time+=33);assert(els.completion.open);assert.equal(els.stageState.textContent,'已通关');const frozen=vm.runInContext('JSON.stringify(sim.p)',context);frame();assert.equal(vm.runInContext('JSON.stringify(sim.p)',context),frozen);let prevented=false;els.completion.oncancel({preventDefault(){prevented=true}});assert(prevented);
els.retry.onclick();frame();assert(!els.completion.open);assert.equal(els.stageNumber.textContent,'01');assert(!vm.runInContext('won',context));
// Exercise transitions without rerunning all 24 physical routes already covered by route.js.
for(let index=0;index<4;index++){
 assert.equal(vm.runInContext('Scene.levels.indexOf(level)',context),index);
 vm.runInContext('paused=true;{let c=sim.center();for(let p of sim.p){p.x+=900-c.x;p.y+=490-c.y}}',context);frame();
 assert(els.completion.open);assert.equal(els.completionStep.textContent,`0${index+1} / 04`);assert.equal(els['progress'+(index+1)].dataset.state,'done');
 if(index<3){assert.equal(els.advance.textContent,'进入下一关 →');assert(els.completionText.textContent.includes('下一关'))}else{assert.equal(els.completionTitle.textContent,'四关全部通关！');assert.equal(els.advance.textContent,'重新开始旅程')}
 els.advance.onclick();frame();assert(!els.completion.open);assert(!vm.runInContext('won',context));assert.equal(els.pause.textContent,'暂停');
}
assert.equal(els.stageNumber.textContent,'01');console.log('通关弹窗、冻结、重玩、逐关推进、最终通关、重新开始、模式切换与画布留白坐标映射检查通过。实际浏览器布局未验收。');
