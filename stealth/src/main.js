// STEALTH DUEL ブラウザ層: core.mjs の状態を Three.js で描画し、入力を渡す。
import * as THREE from 'three';
import { createState, step, botHunter, botIntruder, CFG, MAP_ROWS, CELL, DEVICES, GATES, dist, losClear, angleDiff } from './core.mjs';
import { createNet } from './net.js';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1220);
scene.fog = new THREE.Fog(0x0a1220, 12, 40); // 視界制限が潜入の核
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 80);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
$('app').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x2a3a52, 1.9));
const moon = new THREE.DirectionalLight(0x9fc4ff, 1.2); moon.position.set(10, 30, 6); scene.add(moon);

// マップ構築
const wallMat = new THREE.MeshLambertMaterial({ color: 0x54749c });
const wallGeo = new THREE.BoxGeometry(CELL, 3.2, CELL);
const trimMat = new THREE.MeshBasicMaterial({ color: 0x57d7ff });
for (let z = 0; z < MAP_ROWS.length; z++) for (let x = 0; x < MAP_ROWS[0].length; x++) {
  if (MAP_ROWS[z][x] !== '#') continue;
  const m = new THREE.Mesh(wallGeo, wallMat); m.position.set(x * CELL + 1, 1.6, z * CELL + 1); scene.add(m);
  const t = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.08, 0.12), trimMat); t.position.set(x * CELL + 1, 3.0, z * CELL + 1 - CELL / 2 + 0.06); scene.add(t);
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP_ROWS[0].length * CELL, MAP_ROWS.length * CELL), new THREE.MeshLambertMaterial({ color: 0x2b3e57 }));
floor.rotation.x = -Math.PI / 2; floor.position.set(MAP_ROWS[0].length, 0, MAP_ROWS.length); scene.add(floor);

// 装置・ゲート・痕跡
const deviceMeshes = DEVICES.map(d => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.5), new THREE.MeshLambertMaterial({ color: 0x2c4258 })); body.position.y = 0.75; g.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.45), new THREE.MeshBasicMaterial({ color: 0xffb347 })); scr.position.set(0, 1.05, 0.26); g.add(scr);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.09), new THREE.MeshBasicMaterial({ color: 0x57d7ff })); bar.position.set(-0.31, 0.72, 0.26); bar.geometry.translate(0.31, 0, 0); g.add(bar);
  g.position.set(d.x, 0, d.z); scene.add(g);
  return { group: g, scr, bar };
});
const gateMeshes = GATES.map(g0 => {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.6, 0.3), new THREE.MeshLambertMaterial({ color: 0x51627e })); frame.position.y = 1.3; g.add(frame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.3, 0.14), new THREE.MeshBasicMaterial({ color: 0x24344c })); door.position.set(0, 1.15, 0.2); g.add(door);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4444 })); lamp.position.set(0, 2.75, 0.2); g.add(lamp);
  g.position.set(g0.x, 0, g0.z); scene.add(g);
  return { group: g, door, lamp };
});
function makeFigure(color, visor) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 1.05, 10), new THREE.MeshLambertMaterial({ color })); body.position.y = 0.85; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10), new THREE.MeshLambertMaterial({ color: 0xd8c9a3 })); head.position.y = 1.58; g.add(head);
  const vis = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.05), new THREE.MeshBasicMaterial({ color: visor })); vis.position.set(0, 1.6, -0.19); g.add(vis);
  scene.add(g); return g;
}
const hunterMesh = makeFigure(0x8c2f39, 0xff3344);
const intruderMesh = makeFigure(0x1f6f6b, 0x39e6c8);
const tracePool = [];
for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.16, 8), new THREE.MeshBasicMaterial({ color: 0x39e6c8, transparent: true, opacity: 0 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; scene.add(m); tracePool.push(m); }

// ---- 入力 ----
const input = { moveX: 0, moveZ: 0, action: false, dash: false, crouchToggle: false };
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyC') input.crouchToggle = true; if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => keys[e.code] = false);
let yaw = 0, pitch = 0, pointerLocked = false;
renderer.domElement.addEventListener('click', () => { if (playing && !isTouch) renderer.domElement.requestPointerLock?.(); });
document.addEventListener('pointerlockchange', () => pointerLocked = document.pointerLockElement === renderer.domElement);
addEventListener('mousemove', e => { if (pointerLocked) { yaw += e.movementX * 0.0032; pitch = Math.max(-1.2, Math.min(1.2, pitch - e.movementY * 0.0032)); } });
const isTouch = matchMedia('(pointer: coarse)').matches;
// タッチ: 左スティック + 右半分ドラッグ視点
const stickVec = { x: 0, y: 0 }; let stickId = null, lookId = null, lookLast = null;
const app = $('app');
app.addEventListener('touchstart', e => {
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.42 && t.clientY > innerHeight * 0.45 && stickId === null) stickId = t.identifier;
    else if (lookId === null && !t.target.classList?.contains('tbtn')) { lookId = t.identifier; lookLast = { x: t.clientX, y: t.clientY }; }
  }
}, { passive: false });
app.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === stickId) {
      const r = $('stick').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2);
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      stickVec.x = dx; stickVec.y = dy;
      $('stickKnob').style.transform = `translate(${dx * 32}px,${dy * 32}px)`;
    } else if (t.identifier === lookId && lookLast) {
      yaw += (t.clientX - lookLast.x) * 0.0052; pitch = Math.max(-1.2, Math.min(1.2, pitch - (t.clientY - lookLast.y) * 0.0052));
      lookLast = { x: t.clientX, y: t.clientY };
    }
  }
}, { passive: false });
const endTouch = e => { for (const t of e.changedTouches) { if (t.identifier === stickId) { stickId = null; stickVec.x = 0; stickVec.y = 0; $('stickKnob').style.transform = ''; } if (t.identifier === lookId) { lookId = null; lookLast = null; } } };
app.addEventListener('touchend', endTouch); app.addEventListener('touchcancel', endTouch);
function bindHold(id, on, off) { const el = $(id); const s = e => { e.preventDefault(); el.classList.add('on'); on(); }, x = e => { e.preventDefault(); el.classList.remove('on'); off?.(); }; el.addEventListener('touchstart', s); el.addEventListener('touchend', x); el.addEventListener('mousedown', s); el.addEventListener('mouseup', x); }
bindHold('btnAction', () => input.action = true, () => input.action = false);
bindHold('btnDash', () => input.dash = true, () => input.dash = false);
bindHold('btnCrouch', () => input.crouchToggle = true);

// ---- ゲーム進行 ----
let st = null, playerRole = 'intruder', botMemH = {}, botMemI = {}, playing = false, lastNotice = '';
function startMatch(role) {
  st = createState(); botMemH = {}; botMemI = {};
  beginPlay(role);
}
function notice(text, ms = 1800) { const n = $('notice'); n.textContent = text; n.style.opacity = 1; clearTimeout(notice.t); notice.t = setTimeout(() => n.style.opacity = 0, ms); }
function endMatch() {
  playing = false; document.exitPointerLock?.();
  const win = (st.phase === 'intruder_win') === (playerRole === 'intruder');
  $('endTitle').textContent = st.phase === 'intruder_win' ? '侵入者の脱出成功' : (st.reason === 'capture' ? 'ハンターが捕獲' : '時間切れ｜ハンターの守備成功');
  $('endDetail').textContent = (win ? 'あなたの勝ち。' : 'あなたの負け。') + `\n経過 ${st.t.toFixed(0)}秒／完了装置 ${st.devices.filter(d => d.done).length}台`;
  $('gameHud').classList.add('hidden'); $('endScreen').classList.remove('hidden');
}
$('playIntruder').onclick = () => { mode = 'offline'; startMatch('intruder'); };
$('playHunter').onclick = () => { mode = 'offline'; startMatch('hunter'); };
$('rematch').onclick = () => { if (mode === 'offline') startMatch(playerRole); else location.reload(); };
$('backTitle').onclick = () => { $('endScreen').classList.add('hidden'); $('titleScreen').classList.remove('hidden'); };

// ---- オンライン ----
let mode = 'offline'; // 'offline' | 'host' | 'guest'
let net = null, guestInput = { moveX: 0, moveZ: 0, yaw: 0, action: false, dash: false, crouchToggle: false };
let hostEvents = [], pubSeq = 0, lastPubAt = 0, guestEventCount = 0, guestTarget = null;
function snapOf() {
  return {
    seq: ++pubSeq, t: +st.t.toFixed(2), timeLeft: +st.timeLeft.toFixed(1), phase: st.phase, reason: st.reason,
    hunter: [+st.hunter.x.toFixed(2), +st.hunter.z.toFixed(2), +st.hunter.yaw.toFixed(2)],
    intruder: [+st.intruder.x.toFixed(2), +st.intruder.z.toFixed(2), +st.intruder.yaw.toFixed(2), st.intruder.crouch ? 1 : 0],
    devices: st.devices.map(d => [+d.progress.toFixed(1), d.done ? 1 : 0]),
    gatesOpen: st.gatesOpen, capture: +st.capture.toFixed(2), gateChannel: +st.gateChannel.toFixed(2),
    traces: st.traces.map(t => [+t.x.toFixed(1), +t.z.toFixed(1), +t.ttl.toFixed(1)]),
    hunterKnow: [st.hunterKnow.deviceId, +st.hunterKnow.at.toFixed(1)], events: hostEvents,
  };
}
function applySnap(s) {
  if (!st) { st = createState(); guestEventCount = 0; }
  st.t = s.t; st.timeLeft = s.timeLeft; st.phase = s.phase; st.reason = s.reason;
  guestTarget = { h: s.hunter, i: s.intruder };
  st.hunter.yaw = s.hunter[2]; st.intruder.yaw = s.intruder[2]; st.intruder.crouch = !!s.intruder[3];
  if (!applySnap.placed) { applySnap.placed = true; st.hunter.x = s.hunter[0]; st.hunter.z = s.hunter[1]; st.intruder.x = s.intruder[0]; st.intruder.z = s.intruder[1]; }
  s.devices.forEach((d, i) => { st.devices[i].progress = d[0]; st.devices[i].done = !!d[1]; });
  st.gatesOpen = s.gatesOpen; st.capture = s.capture; st.gateChannel = s.gateChannel;
  st.traces = s.traces.map(t => ({ x: t[0], z: t[1], ttl: t[2] }));
  st.hunterKnow = { deviceId: s.hunterKnow[0], at: s.hunterKnow[1] };
  const evs = s.events || [];
  for (let i = guestEventCount; i < evs.length; i++) st.events.push(evs[i]);
  guestEventCount = evs.length;
  if (!playing && s.phase === 'play') beginPlay(net.role);
  if (playing && s.phase !== 'play') { render(); endMatch(); }
}
function beginPlay(role) {
  playerRole = role; playing = true; hostEvents = []; guestEventCount = 0;
  const me = role === 'intruder' ? st.intruder : st.hunter; yaw = me.yaw; pitch = 0;
  $('titleScreen').classList.add('hidden'); $('endScreen').classList.add('hidden'); $('gameHud').classList.remove('hidden');
  $('roleLabel').textContent = role === 'intruder' ? '🕵️ 侵入者' : '🔦 ハンター';
  $('btnDash').style.display = role === 'intruder' ? 'flex' : 'none';
  $('btnCrouch').style.display = role === 'intruder' ? 'flex' : 'none';
  $('btnAction').textContent = role === 'intruder' ? '操作' : '捕獲';
  notice(role === 'intruder' ? '装置を2台起動して、南のゲートへ' : '装置の反応を頼りに、侵入者を捕まえろ', 2600);
}
function setupNet() {
  if (net) return net;
  net = createNet({
    onStatus: s => { $('netStatus').textContent = s; },
    onStatus2: s => { if (s) $('netStatus').textContent = '状態: ' + s; },
    onPresence: (me, peer) => { $('netStart').classList.toggle('hidden', !(net.isHost && peer)); if (net.code) $('netStatus').textContent = `部屋 ${net.code}／${peer ? '友達が来ました' : '友達を待っています'}`; },
    onRoomReady: () => {},
    onGuestInput: v => { guestInput = { moveX: v.moveX || 0, moveZ: v.moveZ || 0, yaw: v.yaw || 0, action: !!v.action, dash: !!v.dash, crouchToggle: !!v.crouchToggle }; },
    onSnapshot: s => applySnap(s),
  });
  return net;
}
$('netCreateHunter').onclick = () => setupNet().createRoom('hunter');
$('netCreateIntruder').onclick = () => setupNet().createRoom('intruder');
$('netJoin').onclick = () => { const code = $('netCode').value.trim(); if (/^\d{5}$/.test(code)) setupNet().joinRoom(code); else $('netStatus').textContent = '5桁の番号を入力してください'; };
$('netStart').onclick = () => {
  if (!net?.isHost) return;
  mode = 'host'; playerRole = net.role; st = createState(); hostEvents = []; pubSeq = 0;
  net.startMatch(); beginPlay(net.role); net.publishState(snapOf());
};

function playerInput() {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const inp = {
    moveX: Math.abs(stickVec.x) > 0.12 ? stickVec.x : s,
    moveZ: Math.abs(stickVec.y) > 0.12 ? -stickVec.y : f,
    yaw, action: input.action || !!keys.Space, dash: input.dash || !!keys.ShiftLeft || !!keys.ShiftRight,
    crouchToggle: input.crouchToggle,
  };
  input.crouchToggle = false;
  return inp;
}
function consumeEvents() {
  for (const ev of st.events.splice(0)) {
    if (mode === 'host') hostEvents.push(ev);
    if (playerRole === 'hunter' && ev.type === 'ping') notice(`⚠ 装置${'ABCD'[ev.deviceId]}が反応した`, 2200);
    if (playerRole === 'intruder' && ev.type === 'ping') notice('信号が漏れた…ハンターに伝わった', 1600);
    if (ev.type === 'device_done') notice(`装置${'ABCD'[ev.deviceId]} 起動完了`, 1600);
    if (ev.type === 'gates_open') notice('ゲートが開いた！', 2200);
  }
}
// HUDマーカー（画面投影）
const markerEls = {};
function setMarker(key, world, text, color) {
  let el = markerEls[key];
  if (!el) { el = document.createElement('div'); el.className = 'marker'; $('markers').appendChild(el); markerEls[key] = el; }
  const v = new THREE.Vector3(world.x, 1.8, world.z).project(camera);
  if (v.z > 1 || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px'; el.style.top = (-v.y * 0.5 + 0.5) * innerHeight + 'px';
  el.textContent = text; el.style.borderColor = color;
}
function hideMarker(key) { if (markerEls[key]) markerEls[key].style.display = 'none'; }

let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const fdt = Math.min(0.1, (now - last) / 1000); last = now;
  if (playing && st) {
    if (mode === 'guest') {
      net?.sendInput(playerInput());
      if (guestTarget) { const k = Math.min(1, fdt * 12); st.hunter.x += (guestTarget.h[0] - st.hunter.x) * k; st.hunter.z += (guestTarget.h[1] - st.hunter.z) * k; st.intruder.x += (guestTarget.i[0] - st.intruder.x) * k; st.intruder.z += (guestTarget.i[1] - st.intruder.z) * k; }
      consumeEvents();
    } else {
      acc += fdt;
      const dt = 1 / 60;
      while (acc >= dt) {
        const pi = playerInput();
        let inputs;
        if (mode === 'host') inputs = net.role === 'intruder' ? { intruder: pi, hunter: guestInput } : { hunter: pi, intruder: guestInput };
        else inputs = playerRole === 'intruder' ? { intruder: pi, hunter: botHunter(st, botMemH) } : { hunter: pi, intruder: botIntruder(st, botMemI) };
        step(st, inputs, dt); acc -= dt;
        if (st.phase !== 'play') { consumeEvents(); if (mode === 'host') net.publishResult(snapOf()); render(); endMatch(); break; }
      }
      consumeEvents();
      if (mode === 'host' && playing && now - lastPubAt > 125) { lastPubAt = now; net.publishState(snapOf()); }
    }
  }
  render();
}
function render() {
  if (!st) { renderer.render(scene, camera); return; }
  const me = playerRole === 'intruder' ? st.intruder : st.hunter;
  const foe = playerRole === 'intruder' ? st.hunter : st.intruder;
  const myMesh = playerRole === 'intruder' ? intruderMesh : hunterMesh;
  const foeMesh = playerRole === 'intruder' ? hunterMesh : intruderMesh;
  myMesh.visible = false; foeMesh.visible = true;
  const crouch = foe === st.intruder && st.intruder.crouch;
  foeMesh.position.set(foe.x, crouch ? -0.35 : 0, foe.z);
  foeMesh.rotation.y = Math.atan2(Math.sin(foe.yaw), Math.cos(foe.yaw)) + Math.PI; // モデルの正面(-z)を進行方向へ
  foeMesh.rotation.y = -foe.yaw;
  camera.position.set(me.x, (me === st.intruder && st.intruder.crouch) ? 1.05 : 1.62, me.z);
  camera.rotation.set(0, 0, 0); camera.rotation.order = 'YXZ'; camera.rotation.y = -yaw; camera.rotation.x = pitch;
  // 装置・ゲート見た目
  st.devices.forEach((d, i) => { const m = deviceMeshes[i]; m.scr.material.color.set(d.done ? 0x39e6a3 : (d.progress > 0 ? 0xffd257 : 0xffb347)); m.bar.scale.x = Math.max(0.001, d.progress / CFG.deviceTime); });
  gateMeshes.forEach((m, i) => { m.lamp.material.color.set(st.gatesOpen ? 0x39e6a3 : 0xff4444); m.door.position.x = st.gatesOpen ? 0.85 : 0; });
  st.traces.forEach((tr, i) => { if (i < tracePool.length) { const m = tracePool[i]; m.position.x = tr.x; m.position.z = tr.z; m.material.opacity = Math.min(0.55, tr.ttl / CFG.traceLife * 0.55); } });
  for (let i = st.traces.length; i < tracePool.length; i++) tracePool[i].material.opacity = 0;
  renderer.render(scene, camera);
  if (!playing) return;
  // HUD
  const tl = Math.max(0, st.timeLeft);
  $('timer').textContent = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  const done = st.devices.filter(d => d.done).length;
  $('devCount').textContent = `装置 ${done}/2`;
  $('objective').textContent = playerRole === 'intruder' ? (st.gatesOpen ? '南のゲートから脱出（操作長押し）' : `装置をあと${2 - done}台 起動せよ`) : (st.gatesOpen ? 'ゲートを守れ！' : '侵入者を捕獲せよ（近くで捕獲長押し）');
  // 進行バー: 装置/捕獲/ゲート
  let prog = -1;
  if (playerRole === 'intruder') { const d = st.devices.find(d => !d.done && dist(me, d) < CFG.interactRange); if (d) prog = d.progress / CFG.deviceTime; if (st.gatesOpen && GATES.some(g => dist(me, g) < CFG.interactRange)) prog = st.gateChannel / CFG.gateTime; }
  else if (st.capture > 0) prog = st.capture / CFG.captureTime;
  $('progressWrap').style.display = prog >= 0 ? 'block' : 'none';
  if (prog >= 0) $('progressBar').style.width = Math.min(100, prog * 100) + '%';
  // 近接気配（侵入者）: 距離で強さ、相対方位に矢印
  if (playerRole === 'intruder') {
    const d = dist(me, foe);
    const v = $('vignette'); v.style.opacity = d < CFG.proximityRange ? String(Math.min(0.9, (1 - d / CFG.proximityRange) * 1.15)) : '0';
    const ar = $('proxArrow');
    if (d < CFG.proximityRange) { const rel = Math.atan2(foe.x - me.x, -(foe.z - me.z)) - yaw; ar.style.display = 'block'; ar.style.transform = `translate(-50%,-50%) rotate(${rel}rad) translateY(-64px)`; }
    else ar.style.display = 'none';
    st.devices.forEach((dev, i) => setMarker('dev' + i, dev, dev.done ? `装置${'ABCD'[i]} ✓` : `装置${'ABCD'[i]} ${Math.floor(dev.progress / CFG.deviceTime * 100)}%`, dev.done ? '#39e6a3' : '#57d7ff'));
    GATES.forEach((g, i) => setMarker('gate' + i, g, st.gatesOpen ? 'ゲート（開）' : 'ゲート', st.gatesOpen ? '#39e6a3' : '#8899bb'));
  } else {
    $('vignette').style.opacity = '0'; $('proxArrow').style.display = 'none';
    st.devices.forEach((dev, i) => { if (st.hunterKnow.deviceId === i && st.t - st.hunterKnow.at < 12) setMarker('dev' + i, dev, `装置${'ABCD'[i]} 反応`, '#ff5d5d'); else hideMarker('dev' + i); });
    GATES.forEach((g, i) => setMarker('gate' + i, g, st.gatesOpen ? 'ゲート（開）' : 'ゲート', st.gatesOpen ? '#ff5d5d' : '#8899bb'));
  }
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
requestAnimationFrame(frame);
// 自動テスト/検証用フック（通常プレイでは未使用）
window.StealthGame = { startMatch, get state() { return st; }, setYaw(v) { yaw = v; }, input, THREE, scene, camera };
