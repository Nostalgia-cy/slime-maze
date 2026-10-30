const $ = s => document.querySelector(s),
  canvas = $('canvas'),
  ctx = canvas.getContext('2d');
let sim,
  skin,
  ffdMetrics = null,
  recordingUrl = null,
  ffd = new FFD(),
  mode = 'maze',
  drag = null,
  handle = -1,
  acc = 0,
  last = 0,
  paused = false,
  playing = false,
  animationTime = 0,
  tour = null,
  recorder = null,
  won = false;
let level = Scene.levels[0],
  walls = level.walls;
function reset() {
  sim = new Slime({
    stiffness: +$('#soft').value,
    recovery: $('#recover').checked,
    solver: $('#solver').value
  });
  skin = new SoftBodySkin(sim.p);
  ffd.reset();
  ffdMetrics = null;
  drag = null;
  handle = -1;
  playing = false;
  $('#keys').textContent = '播放起跳动作';
  animationTime = 0;
  acc = 0;
  tour = null;
  won = false;
  if ($('#completion').open) $('#completion').close();
  $('#tour').textContent = '自动演示';
  if (recorder?.state !== 'recording') $('#notice').textContent = '';
}
reset();
function setMode(next) {
  mode = next;
  drag = null;
  handle = -1;
  $('#maze').classList.toggle('active', mode === 'maze');
  $('#studio').classList.toggle('active', mode === 'studio');
  $('#maze').setAttribute('aria-pressed', String(mode === 'maze'));
  $('#studio').setAttribute('aria-pressed', String(mode === 'studio'));
  canvas.setAttribute('aria-label', mode === 'maze' ? '按住并拖动，带史莱姆穿过迷宫' : '拖动金色控制点，改变史莱姆的形状');
  $('#physicsControls').hidden = mode !== 'maze';
  $('#ffdControls').hidden = mode !== 'studio';
  $('#levelControls').hidden = mode !== 'maze';
  $('#hint').textContent = mode === 'maze' ? '按住画布引导史莱姆，松开后看它慢慢恢复。金色旗帜就是终点。' : '拖动金色控制点，改变史莱姆的模样。也可以试试预设，或播放一段起跳动作。';
}
function loadLevel(index) {
  level = Scene.levels[index];
  walls = level.walls;
  reset();
  paused = false;
  $('#pause').textContent = '暂停';
  setMode('maze');
  canvas.focus({
    preventScroll: true
  });
}
$('#advance').onclick = () => {
  if (won) loadLevel((Scene.levels.indexOf(level) + 1) % Scene.levels.length);
};
$('#retry').onclick = () => loadLevel(Scene.levels.indexOf(level));
$('#completion').oncancel = e => e.preventDefault();
function completeLevel() {
  won = true;
  drag = null;
  tour = null;
  acc = 0;
  $('#tour').textContent = '自动演示';
  const index = Scene.levels.indexOf(level),
    last = index === Scene.levels.length - 1;
  $('#completionStep').textContent = `${String(index + 1).padStart(2, '0')} / 04`;
  $('#completionTitle').textContent = last ? '四关全部通关！' : '这一关，穿过去了！';
  $('#completionText').textContent = last ? '从第一道窄门到最后一面旗帜，史莱姆完成了整段旅程。' : `${level.name}已完成。下一关：${Scene.levels[index + 1].name}。`;
  $('#advance').textContent = last ? '重新开始旅程' : '进入下一关 →';
  $('#completion').showModal();
}
$('#maze').onclick = () => setMode('maze');
$('#studio').onclick = () => setMode('studio');
$('#reset').onclick = reset;
$('#solver').onchange = e => {
  sim.solver = e.target.value;
};
$('#soft').oninput = e => sim.stiffness = +e.target.value;
$('#recover').onchange = e => sim.recovery = e.target.checked;
$('#pause').onclick = () => {
  paused = !paused;
  $('#pause').textContent = paused ? '继续' : '暂停';
};
for (let b of document.querySelectorAll('[data-preset]')) b.onclick = () => {
  playing = false;
  $('#keys').textContent = '播放起跳动作';
  ffd.preset(b.dataset.preset);
  ffdMetrics = null;
};
$('#keys').onclick = () => {
  animationTime = 0;
  playing = !playing;
  $('#keys').textContent = playing ? '停止播放' : '播放起跳动作';
};
function point(e) {
  let r = canvas.getBoundingClientRect(),
    scale = Math.min(r.width / 960, r.height / 540),
    x = (e.clientX - r.left - (r.width - 960 * scale) / 2) / scale,
    y = (e.clientY - r.top - (r.height - 540 * scale) / 2) / scale;
  return {
    x: Math.max(0, Math.min(960, x)),
    y: Math.max(0, Math.min(540, y)),
    inside: x >= 0 && x <= 960 && y >= 0 && y <= 540
  };
}
canvas.onpointerdown = e => {
  if (mode === 'maze' && won) return;
  let p = point(e);
  if (!p.inside) return;
  tour = null;
  $('#tour').textContent = '自动演示';
  canvas.setPointerCapture(e.pointerId);
  if (mode === 'maze') drag = p;else {
    playing = false;
    $('#keys').textContent = '播放起跳动作';
    let best = 22;
    handle = -1;
    ffd.controls.forEach((q, i) => {
      let d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < best) {
        best = d;
        handle = i;
      }
    });
  }
};
canvas.onpointermove = e => {
  let p = point(e);
  if (mode === 'maze' && drag) drag = p;
  if (mode === 'studio' && handle >= 0) {
    ffd.controls[handle] = {
      x: Math.max(30, Math.min(930, p.x)),
      y: Math.max(30, Math.min(510, p.y))
    };
    ffdMetrics = null;
  }
};
function release() {
  drag = null;
  handle = -1;
}
canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = release;
window.addEventListener('blur', release);
function line(a, b, color = '#3a686b') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
function path(points) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
}
function body(points, face) {
  path(points);
  let g = ctx.createLinearGradient(0, Math.min(...points.map(p => p.y)), 0, Math.max(...points.map(p => p.y)));
  g.addColorStop(0, '#b4f8c7');
  g.addColorStop(1, '#36b6a0');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#d2ffe1';
  ctx.stroke();
  ctx.save();
  ctx.clip();
  // The same material samples drive eyes, mouth, highlights and bubbles in both modes.
  function spot(u, v, rx, ry, color) {
    const points = Array.from({
      length: 32
    }, (_, i) => {
      const a = i * Math.PI / 16;
      return face(u + rx * Math.cos(a), v + ry * Math.sin(a));
    });
    path(points);
    ctx.fillStyle = color;
    ctx.fill();
  }
  spot(.42, .34, .055, .022, 'rgba(236,255,235,.48)');
  for (const [u, v] of [[.62, .65], [.36, .58], [.58, .31]]) spot(u, v, .015, .015, 'rgba(224,255,229,.2)');
  ctx.fillStyle = '#173e3d';
  for (let u of [.44, .56]) {
    let eye = Array.from({
      length: 24
    }, (_, i) => {
      let a = i * Math.PI / 12;
      return face(u + .014 * Math.cos(a), .48 + .024 * Math.sin(a));
    });
    path(eye);
    ctx.fill();
  }
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    let a = i * Math.PI / 24,
      p = face(.5 + .04 * Math.cos(a), .54 + .025 * Math.sin(a));
    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
  }
  ctx.strokeStyle = '#173e3d';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}
function background() {
  let g = ctx.createLinearGradient(0, 0, 960, 540);
  g.addColorStop(0, '#122a35');
  g.addColorStop(1, '#091b2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 960, 540);
  ctx.lineWidth = 1;
  if ($('#debug').checked) {
    for (let x = 0; x < 960; x += 30) line({
      x,
      y: 0
    }, {
      x,
      y: 540
    }, '#193444');
    for (let y = 0; y < 540; y += 30) line({
      x: 0,
      y
    }, {
      x: 960,
      y
    }, '#193444');
  }
  for (let i = 0; i < 55; i++) {
    let x = (i * 173 + 41) % 960,
      y = (i * i * 37 + 63) % 540;
    ctx.fillStyle = i % 3 ? '#213f4a' : '#3b6462';
    ctx.beginPath();
    ctx.arc(x, y, i % 3 ? 1 : 1.8, 0, 7);
    ctx.fill();
  }
}
function drawMaze() {
  for (const o of walls) {
    let g = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
    g.addColorStop(0, '#506c74');
    g.addColorStop(.18, '#304e59');
    g.addColorStop(1, '#203b48');
    ctx.fillStyle = g;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    for (let y = o.y + 30; y < o.y + o.h; y += 45) line({
      x: o.x + 3,
      y
    }, {
      x: o.x + o.w - 3,
      y: y - 3
    }, '#1b3340');
    ctx.fillStyle = '#6e9b83';
    for (let y = o.y + 12; y < o.y + o.h; y += 71) {
      ctx.beginPath();
      ctx.ellipse(o.x + 4, y, 6, 2, .7, 0, 7);
      ctx.fill();
    }
  }
  let glow = ctx.createRadialGradient(898, 490, 5, 898, 490, 65);
  glow.addColorStop(0, 'rgba(245,205,112,.25)');
  glow.addColorStop(1, 'rgba(245,205,112,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(833, 425, 127, 115);
  ctx.strokeStyle = '#d8bc73';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(898, 520, 31, 8, 0, 0, 7);
  ctx.stroke();
  line({
    x: 894,
    y: 458
  }, {
    x: 894,
    y: 511
  }, '#efcf85');
  ctx.fillStyle = '#efcf85';
  ctx.beginPath();
  ctx.moveTo(894, 456);
  ctx.lineTo(919, 465);
  ctx.lineTo(894, 478);
  ctx.closePath();
  ctx.fill();
  let c = sim.center();
  if (!won && c.x > 865 && c.y > 440) completeLevel();
  body(sim.p, (u, v) => skin.sample(sim.p, u, v));
  if ($('#debug').checked) {
    for (let [i, j] of sim.links) line(sim.p[i], sim.p[j], '#267c76');
    for (let p of sim.p) {
      ctx.fillStyle = 'white';
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
  }
  if (drag) {
    line(c, drag, '#eaca7a');
    ctx.strokeStyle = '#eaca7a';
    ctx.beginPath();
    ctx.arc(drag.x, drag.y, 8, 0, 7);
    ctx.stroke();
  }
  let m = $('#debug').checked ? sim.metrics() : null;
  $('#status').textContent = $('#debug').checked ? `面积偏差 ${(m.areaError * 100).toFixed(2)}% · 拟合后形变 ${(m.shapeError * 100).toFixed(1)}% · 结构误差 ${m.distanceError.toFixed(2)} px${won ? ' · 到达终点！' : ''}` : won ? '到达终点！史莱姆成功穿过了迷宫。' : level.hint;
}
function drawFFD() {
  if ($('#debug').checked) {
    for (let a = 0; a <= 10; a++) {
      for (let b = 0; b < 40; b++) {
        line(ffd.evaluate(a / 10, b / 40), ffd.evaluate(a / 10, (b + 1) / 40), '#35656c');
        line(ffd.evaluate(b / 40, a / 10), ffd.evaluate((b + 1) / 40, a / 10), '#35656c');
      }
    }
  }
  body(ffd.contour(), (u, v) => ffd.evaluate(u, v));
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    let p = ffd.controls[j * 4 + i];
    if (i < 3) line(p, ffd.controls[j * 4 + i + 1], '#937d4e');
    if (j < 3) line(p, ffd.controls[(j + 1) * 4 + i], '#937d4e');
    ctx.fillStyle = '#f3cd7c';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, 7);
    ctx.fill();
  }
  let m = ffdMetrics || (ffdMetrics = ffd.metrics());
  $('#status').textContent = m.minJacobian <= 0 ? '形状出现折叠，可以回调控制点或重新开始。' : $('#debug').checked ? `轮廓面积比 ${m.areaRatio.toFixed(3)} · 最小局部面积比 ${m.minJacobian.toFixed(3)}` : playing ? '挤压、起跳、落地，再轻轻弹回来。' : '拖动金色控制点，捏出自己的史莱姆。';
}
function updateHud() {
  const text = (id, value) => {
    if ($(id).textContent !== value) $(id).textContent = value;
  };
  text('#stageTitle', mode === 'maze' ? level.name : '捏捏工作台');
  text('#stageNumber', mode === 'maze' ? String(Scene.levels.indexOf(level) + 1).padStart(2, '0') : '◇');
  text('#levelDescription', level.hint);
  for (let i = 0; i < 4; i++) {
    const current = Scene.levels.indexOf(level);
    $('#progress' + (i + 1)).dataset.state = i < current ? 'done' : i === current ? won ? 'done' : 'current' : 'locked';
  }
  text('#helpTitle', mode === 'maze' ? '轻轻一拖，就出发' : '每个形状，都由你决定');
  const state = paused ? '已暂停' : mode === 'studio' ? playing ? '播放中' : '自由创作' : won ? '已通关' : tour ? '演示中' : '自由探索';
  text('#stageState', state);
  $('#stageState').dataset.state = won && mode === 'maze' ? 'won' : 'active';
  $('#record').classList.toggle('recording', recorder?.state === 'recording');
  $('#noticeWrap').hidden = !$('#notice').textContent && $('#recordingDownload').hidden;
}
// Frame intervals include browser scheduling; solver timing excludes drawing and DOM work.
let statsStart = 0,
  frameIntervals = [],
  solverMillis = 0,
  solverSteps = 0;
function resetFrameStats() {
  statsStart = 0;
  frameIntervals = [];
  solverMillis = 0;
  solverSteps = 0;
  $('#performanceStats').textContent = '正在测量…';
}
$('#debug').onchange = resetFrameStats;
function updateFrameStats(t, interval) {
  const output = $('#performanceStats');
  output.hidden = !$('#debug').checked;
  if (output.hidden) return;
  if (document.hidden || interval <= 0 || interval > 250) {
    resetFrameStats();
    return;
  }
  if (!statsStart) statsStart = t;
  frameIntervals.push(interval);
  if (t - statsStart < 1000) return;
  const sorted = [...frameIntervals].sort((a, b) => a - b),
    mean = frameIntervals.reduce((a, b) => a + b, 0) / frameIntervals.length;
  const p95 = sorted[Math.ceil(sorted.length * .95) - 1];
  output.textContent = `${(1000 / mean).toFixed(1)} FPS · 帧间隔 P95 ${p95.toFixed(1)} ms · 求解 ${solverSteps ? (solverMillis / solverSteps).toFixed(2) + ' ms/步' : '—'}`;
  statsStart = t;
  frameIntervals = [];
  solverMillis = 0;
  solverSteps = 0;
}
function frame(t) {
  const interval = t - last,
    elapsed = Math.max(0, Math.min(interval / 1000, .05));
  last = t;
  if (!paused && (mode !== 'maze' || !won)) {
    if (mode === 'maze') {
      acc += elapsed;
      const measuring = $('#debug').checked,
        solveStart = measuring ? performance.now() : 0;
      while (acc >= 1 / 120) {
        const target = tour ? tour.target(sim) : drag;
        sim.step({
          target,
          obstacles: walls
        });
        if (measuring) solverSteps++;
        if (tour?.failed) {
          $('#notice').textContent = '这次演示停在了障碍附近，可以重试或手动引导。';
          tour = null;
          $('#tour').textContent = '自动演示';
        } else if (tour?.done) {
          tour = null;
          $('#tour').textContent = '自动演示';
        }
        acc -= 1 / 120;
      }
      if (measuring) solverMillis += performance.now() - solveStart;
    } else if (playing) {
      animationTime += elapsed;
      ffd.pose(animationTime % 3.6);
      ffdMetrics = null;
    }
  }
  background();
  mode === 'maze' ? drawMaze() : drawFFD();
  updateHud();
  updateFrameStats(t, interval);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('#tour').onclick = () => {
  if (tour) {
    tour = null;
    $('#tour').textContent = '自动演示';
    return;
  }
  setMode('maze');
  reset();
  paused = false;
  $('#pause').textContent = '暂停';
  tour = new Scene.Tour(level);
  $('#tour').textContent = '停止演示';
  $('#notice').textContent = level.name + ' · 自动演示中，按住画布可接手操作。';
};
// Keep the last download available across resets and release URLs only when replaced.
function stopRecordingTracks(stream) {
  stream?.getTracks().forEach(track => track.stop());
}
$('#record').onclick = () => {
  const button = $('#record');
  if (button.disabled) return;
  if (recorder?.state === 'recording') {
    button.disabled = true;
    button.textContent = '正在保存…';
    recorder.stop();
    return;
  }
  if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
    $('#notice').textContent = '当前浏览器不支持页面录制，可以使用 Mac 系统录屏。';
    return;
  }
  let stream,
    capture,
    failed = false;
  try {
    stream = canvas.captureStream(30);
    const mime = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) throw Error('unsupported');
    const chunks = [];
    capture = new MediaRecorder(stream, {
      mimeType: mime
    });
    recorder = capture;
    capture.ondataavailable = e => {
      if (e.data.size) chunks.push(e.data);
    };
    capture.onstop = () => {
      stopRecordingTracks(stream);
      // A delayed event from a failed capture must not reset a newer recording.
      if (recorder !== capture) return;
      recorder = null;
      button.disabled = false;
      button.textContent = '录制动画';
      if (failed) return;
      if (!chunks.length) {
        $('#notice').textContent = '这次没有录到画面，请重新录制。';
        return;
      }
      const blob = new Blob(chunks, {
        type: capture.mimeType || mime
      });
      const url = URL.createObjectURL(blob),
        download = $('#recordingDownload');
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      recordingUrl = url;
      download.href = url;
      download.download = '史莱姆演示.' + (blob.type.includes('mp4') ? 'mp4' : 'webm');
      download.hidden = false;
      $('#notice').textContent = '录制完成。';
    };
    capture.onerror = () => {
      failed = true;
      stopRecordingTracks(stream);
      if (recorder === capture) recorder = null;
      button.disabled = false;
      button.textContent = '录制动画';
      $('#notice').textContent = '录制失败，请重试或使用系统录屏。';
    };
    capture.start();
    button.textContent = '结束录制';
    $('#notice').textContent = '正在录制画布，结束后可保存视频。';
  } catch (error) {
    failed = true;
    stopRecordingTracks(stream);
    if (recorder === capture) recorder = null;
    button.disabled = false;
    button.textContent = '录制动画';
    $('#notice').textContent = '当前浏览器无法启动录制，可以使用 Mac 系统录屏。';
  }
};
window.addEventListener('beforeunload', () => {
  if (recordingUrl) URL.revokeObjectURL(recordingUrl);
});
