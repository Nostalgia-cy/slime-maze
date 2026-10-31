// UI state and event checks; this is not a real browser layout test.
const vm = require("node:vm");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");
let scheduled;
let drawCalls = 0;
let rect = {
  left: 0,
  top: 0,
  width: 960,
  height: 540
};
const gradient = {
  addColorStop() {}
};
const ctx = new Proxy({
  createLinearGradient() {
    return gradient;
  },
  createRadialGradient() {
    return gradient;
  }
}, {
  get(o, k) {
    if (k in o) {
      return o[k];
    }
    return () => drawCalls++;
  },
  set(o, k, v) {
    o[k] = v;
    return true;
  }
});
const ids = ["completion", "completionTitle", "completionText", "completionStep", "advance", "retry", "progress1", "progress2", "progress3", "progress4", "stageTitle", "stageNumber", "stageState", "levelDescription", "helpTitle", "levelControls", "tour", "record", "notice", "noticeWrap", "recordingDownload", "performanceStats", "canvas", "soft", "recover", "solver", "maze", "studio", "physicsControls", "ffdControls", "hint", "reset", "pause", "keys", "status", "debug"];
const els = {};
for (const id of ids) {
  els[id] = {
    value: id === "soft" ? ".35" : id === "solver" ? "pbd" : "",
    checked: id === "recover",
    classList: {
      toggle() {}
    },
    dataset: {},
    setAttribute(k, v) {
      this[k] = v;
    },
    focus() {},
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    open: false,
    hidden: false
  };
}
Object.assign(els.canvas, {
  getContext: () => ctx,
  setPointerCapture() {},
  getBoundingClientRect: () => rect
});
const context = vm.createContext({
  performance,
  Blob,
  document: {
    querySelector: s => {
      const el = els[s.replace("#", "")];
      assert(el, "missing " + s);
      return el;
    },
    querySelectorAll: () => []
  },
  window: {
    addEventListener() {}
  },
  requestAnimationFrame: fn => scheduled = fn
});
for (const f of ["scene.js", "collision.js", "physics.js", "skin.js", "ffd.js", "ui.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src", f), "utf8"), context);
}
els.recordingDownload.hidden = true;
let time = 0;
const frame = () => scheduled(time += 16);
frame();
assert(drawCalls > 0);
assert.equal(els.stageTitle.textContent, "苔石窄门");
assert(!els.completion.open);
els.advance.onclick();
frame();
assert.equal(els.stageNumber.textContent, "01");
els.studio.onclick();
frame();
assert(els.physicsControls.hidden);
assert.equal(els.stageTitle.textContent, "捏捏工作台");
assert.equal(els.studio["aria-pressed"], "true");
els.keys.onclick();
frame();
assert.equal(els.stageState.textContent, "播放中");
els.maze.onclick();
// Switching solvers must preserve the same particles, implicit velocities, and campaign state.
vm.runInContext("{const c=sim.center();for(let i=0;i<sim.p.length;i++){const p=sim.p[i];p.x+=200;p.y+=50;if(i%4===0)p.x+=2}}", context);
const switchState = vm.runInContext("JSON.stringify({particles:sim.p,level:Scene.levels.indexOf(level),won,paused})", context);
for (const value of ["spring", "pbd", "spring"]) {
  els.solver.value = value;
  els.solver.onchange({
    target: els.solver
  });
  assert.equal(vm.runInContext("sim.solver", context), value);
  assert.equal(vm.runInContext("JSON.stringify({particles:sim.p,level:Scene.levels.indexOf(level),won,paused})", context), switchState);
}
els.reset.onclick();
// The canvas can be letterboxed by the viewport; pointer mapping must use the displayed image.
rect = {
  left: 0,
  top: 0,
  width: 480,
  height: 540
};
els.canvas.onpointerdown({
  pointerId: 1,
  clientX: 120,
  clientY: 195
});
assert.equal(vm.runInContext("drag.x", context), 240);
assert.equal(vm.runInContext("drag.y", context), 120);
els.canvas.onpointerup();
els.canvas.onpointerdown({
  pointerId: 1,
  clientX: 100,
  clientY: 20
});
assert.equal(vm.runInContext("drag", context), null);
rect = {
  left: 0,
  top: 0,
  width: 960,
  height: 540
};
els.pause.onclick();
frame();
assert.equal(els.stageState.textContent, "已暂停");
els.pause.onclick();
// One real scripted tour must open completion, rather than merely changing a status label.
els.tour.onclick();
for (let i = 0; i < 400 && !els.completion.open; i++) {
  scheduled(time += 33);
}

assert(els.completion.open);
assert.equal(els.stageState.textContent, "已通关");
const frozen = vm.runInContext("JSON.stringify(sim.p)", context);
frame();
assert.equal(vm.runInContext("JSON.stringify(sim.p)", context), frozen);
let prevented = false;
els.completion.oncancel({
  preventDefault() {
    prevented = true;
  }
});
assert(prevented);
els.retry.onclick();
frame();
assert(!els.completion.open);
assert.equal(els.stageNumber.textContent, "01");
assert(!vm.runInContext("won", context));
// Exercise transitions without rerunning all 24 physical routes already covered by route.js.
for (let index = 0; index < 4; index++) {
  assert.equal(vm.runInContext("Scene.levels.indexOf(level)", context), index);
  vm.runInContext("paused=true;{let c=sim.center();for(let p of sim.p){p.x+=900-c.x;p.y+=490-c.y}}", context);
  frame();
  assert(els.completion.open);
  assert.equal(els.completionStep.textContent, `0${index + 1} / 04`);
  assert.equal(els["progress" + (index + 1)].dataset.state, "done");
  if (index < 3) {
    assert.equal(els.advance.textContent, "进入下一关 →");
    assert(els.completionText.textContent.includes("下一关"));
  } else {
    assert.equal(els.completionTitle.textContent, "四关全部通关！");
    assert.equal(els.advance.textContent, "重新开始旅程");
  }
  els.advance.onclick();
  frame();
  assert(!els.completion.open);
  assert(!vm.runInContext("won", context));
  assert.equal(els.pause.textContent, "暂停");
}
assert.equal(els.stageNumber.textContent, "01");
console.log("通关弹窗、冻结、重玩、逐关推进、最终通关、重新开始、模式切换与画布留白坐标映射检查通过。实际浏览器布局未验收。");

// Diagnostics use rAF timestamps, rather than claiming core timing equals browser FPS.
els.debug.checked = true;
els.debug.onchange();
for (let i = 0; i < 70; i++) {
  frame();
}
assert.match(els.performanceStats.textContent, /62\.5 FPS.*P95 16\.0 ms/);
context.document.hidden = true;
frame();
assert.equal(els.performanceStats.textContent, "正在测量…");
context.document.hidden = false;
els.debug.checked = false;
els.debug.onchange();
frame();
assert(els.performanceStats.hidden);

// An unchanged FFD pose should not repeat the 21x21 Jacobian scan each frame.
els.reset.onclick();
els.studio.onclick();
vm.runInContext("var metricCalls=0;var originalMetrics=ffd.metrics.bind(ffd);ffd.metrics=()=>{metricCalls++;return originalMetrics()}", context);
frame();
frame();
assert.equal(vm.runInContext("metricCalls", context), 1);
els.canvas.onpointerdown({
  pointerId: 1,
  clientX: 330,
  clientY: 110
});
els.canvas.onpointermove({
  clientX: 345,
  clientY: 115
});
els.canvas.onpointerup();
frame();
assert.equal(vm.runInContext("metricCalls", context), 2);
els.maze.onclick();

// MediaRecorder events are mocked here; this does not test a browser's encoder.
const captures = [];
const streams = [];
const revoked = [];
let nextUrl = 0;
class MockRecorder {
  static isTypeSupported(type) {
    return type === "video/mp4";
  }

  constructor(stream, options) {
    this.state = "inactive";
    this.mimeType = options.mimeType;
    captures.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
  }

  finish(data = new Blob(["encoded-frame"])) {
    this.ondataavailable({
      data
    });
    this.onstop();
  }
}
context.MediaRecorder = MockRecorder;
context.URL = {
  createObjectURL() {
    return "blob:test-" + ++nextUrl;
  },
  revokeObjectURL(url) {
    revoked.push(url);
  }
};
els.canvas.captureStream = fps => {
  assert.equal(fps, 30);
  const track = {
    stopped: false,
    stop() {
      this.stopped = true;
    }
  };
  streams.push(track);
  return {
    getTracks: () => [track]
  };
};
els.record.onclick();
assert.equal(captures[0].state, "recording");
els.record.onclick();
assert(els.record.disabled);
els.record.onclick();
assert.equal(captures.length, 1);
captures[0].finish();
assert(!els.record.disabled);
assert(streams[0].stopped);
assert.equal(els.recordingDownload.download, "史莱姆演示.mp4");
assert.equal(els.recordingDownload.href, "blob:test-1");
els.reset.onclick();
frame();
assert(!els.recordingDownload.hidden);
assert(!els.noticeWrap.hidden);
assert.equal(els.recordingDownload.href, "blob:test-1");
els.record.onclick();
els.record.onclick();
captures[1].finish();
assert.deepEqual(revoked, ["blob:test-1"]);
assert.equal(els.recordingDownload.href, "blob:test-2");
els.record.onclick();
els.record.onclick();
captures[2].finish(new Blob([]));
assert.match(els.notice.textContent, /没有录到/);
assert.equal(els.recordingDownload.href, "blob:test-2");

// Late stop after an encoder failure cannot unlock or rename the next capture.
els.record.onclick();
const failed = captures[3];
failed.onerror();
assert(streams[3].stopped);
els.record.onclick();
const current = captures[4];
failed.onstop();
assert.equal(vm.runInContext("recorder", context), current);
assert.equal(els.record.textContent, "结束录制");
els.record.onclick();
current.finish();
MockRecorder.isTypeSupported = () => false;
els.record.onclick();
assert(streams.at(-1).stopped);
assert(!els.record.disabled);
assert.match(els.notice.textContent, /无法启动/);
delete context.MediaRecorder;
els.record.onclick();
assert.match(els.notice.textContent, /不支持/);
console.log("帧率统计、后台重置、录制停止互锁、空视频、失败重试、旧事件隔离、下载保留与 URL 释放检查通过。浏览器编码仍待实测。");
