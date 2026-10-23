// STEALTH DUEL v2 ブラウザ層: 病院マップ / 暗闇とライト / ミニマップ / 発見システム
import * as THREE from 'three';
import { createState, step, botHunter, botIntruder, CFG, MAP_ROWS, CELL, TERMINALS, GATES, ZONES, dist, losClear } from './core.mjs';
import { createNet } from './net.js';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060a);
scene.fog = new THREE.Fog(0x04060a, 3, 14);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.08, 90);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
$('app').appendChild(renderer.domElement);
const ambLight = new THREE.AmbientLight(0x33415c, 1.25);
const hemiLight = new THREE.HemisphereLight(0x44597a, 0x0c1018, 0.7);
scene.add(ambLight); scene.add(hemiLight);

// ---- マップ構築 ----
const MW = MAP_ROWS[0].length * CELL, MH = MAP_ROWS.length * CELL;
function cellChar(x, z) { return MAP_ROWS[z]?.[x] ?? '#'; }
// 床（ゾーン色＋共通下地）
const baseFloor = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshLambertMaterial({ color: 0x1c2735 }));
baseFloor.rotation.x = -Math.PI / 2; baseFloor.position.set(MW / 2, -0.02, MH / 2); scene.add(baseFloor);
for (const zn of ZONES) {
  const w = (zn.x1 - zn.x0 + 1) * CELL, d = (zn.z1 - zn.z0 + 1) * CELL;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: zn.color }));
  f.rotation.x = -Math.PI / 2; f.position.set(zn.x0 * CELL + w / 2, 0, zn.z0 * CELL + d / 2); scene.add(f);
}
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshBasicMaterial({ color: 0x0a0f16 }));
ceil.rotation.x = Math.PI / 2; ceil.position.set(MW / 2, 3.3, MH / 2); scene.add(ceil);
// 壁（インスタンス）
{
  const cells = [];
  for (let z = 0; z < MAP_ROWS.length; z++) for (let x = 0; x < MAP_ROWS[0].length; x++) if (cellChar(x, z) === '#') cells.push([x, z]);
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 3.3, CELL), new THREE.MeshLambertMaterial({ color: 0x77879c }), cells.length);
  const m4 = new THREE.Matrix4();
  cells.forEach(([x, z], i) => { m4.setPosition(x * CELL + 1, 1.65, z * CELL + 1); inst.setMatrixAt(i, m4); });
  scene.add(inst);
  // 壁の腰ライン（視認性）
  const trim = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 0.5, CELL + 0.04), new THREE.MeshLambertMaterial({ color: 0x4b5a6e }), cells.length);
  cells.forEach(([x, z], i) => { m4.setPosition(x * CELL + 1, 0.25, z * CELL + 1); trim.setMatrixAt(i, m4); });
  scene.add(trim);
}
// 棚 S（高い遮蔽）
{
  const cells = [];
  for (let z = 0; z < MAP_ROWS.length; z++) for (let x = 0; x < MAP_ROWS[0].length; x++) if (cellChar(x, z) === 'S') cells.push([x, z]);
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 2.3, 0.8), new THREE.MeshLambertMaterial({ color: 0x2e4f4a }), cells.length);
  const m4 = new THREE.Matrix4();
  cells.forEach(([x, z], i) => { m4.makeRotationY(((x + z) % 2) * Math.PI / 2); m4.setPosition(x * CELL + 1, 1.15, z * CELL + 1); inst.setMatrixAt(i, m4); });
  scene.add(inst);
}
// ベッド等 B（低い遮蔽）: 白い台＋枕
{
  const cells = [];
  for (let z = 0; z < MAP_ROWS.length; z++) for (let x = 0; x < MAP_ROWS[0].length; x++) if (cellChar(x, z) === 'B') cells.push([x, z]);
  const base = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.55, 1.1), new THREE.MeshLambertMaterial({ color: 0xb9c4cf }), cells.length);
  const pil = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.16, 0.8), new THREE.MeshLambertMaterial({ color: 0xe8eef4 }), cells.length);
  const m4 = new THREE.Matrix4();
  cells.forEach(([x, z], i) => { const rot = ((x * 3 + z) % 2) * Math.PI / 2; m4.makeRotationY(rot); m4.setPosition(x * CELL + 1, 0.28, z * CELL + 1); base.setMatrixAt(i, m4); m4.makeRotationY(rot); m4.setPosition(x * CELL + 1 + (rot ? 0 : -0.55), 0.62, z * CELL + 1 + (rot ? -0.55 : 0)); pil.setMatrixAt(i, m4); });
  scene.add(base); scene.add(pil);
}
// ゾーン看板（Canvasテクスチャ）
function textPlate(text, w, h, fg, bg) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * h / w);
  const c = cv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = fg; c.font = `bold ${Math.round(cv.height * 0.52)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, cv.width / 2, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}
for (const zn of ZONES) {
  const s = textPlate(zn.name, 3.4, 0.85, '#cfe4ff', '#16283e');
  s.position.set((zn.x0 + zn.x1 + 1) * CELL / 2, 2.7, zn.z0 * CELL + 0.15); scene.add(s);
  const s2 = s.clone(); s2.rotation.y = Math.PI; s2.position.z = (zn.z1 + 1) * CELL - 0.15; scene.add(s2);
}
// 端末（候補6台すべて見た目を用意）
const termMeshes = TERMINALS.map(t => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.5), new THREE.MeshLambertMaterial({ color: 0x2c4258 })); body.position.y = 0.75; g.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.45), new THREE.MeshBasicMaterial({ color: 0x141e2c })); scr.position.set(0, 1.05, 0.26); g.add(scr);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.09), new THREE.MeshBasicMaterial({ color: 0x57d7ff })); bar.geometry.translate(0.31, 0, 0); bar.position.set(-0.31, 0.72, 0.26); g.add(bar);
  const plate = textPlate(t.name, 1.5, 0.34, '#ffd9a0', '#1c2a3e'); plate.position.set(0, 1.78, 0.1); g.add(plate);
  g.position.set(t.x, 0, t.z); scene.add(g);
  return { group: g, scr, bar };
});
const gateMeshes = GATES.map(g0 => {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.6, 0.3), new THREE.MeshLambertMaterial({ color: 0x51627e })); frame.position.y = 1.3; g.add(frame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.3, 0.14), new THREE.MeshBasicMaterial({ color: 0x24344c })); door.position.set(0, 1.15, 0.2); g.add(door);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4444 })); lamp.position.set(0, 2.78, 0.2); g.add(lamp);
  const sign = textPlate('出口 EXIT', 1.7, 0.42, '#a7ffd0', '#0d3320'); sign.position.set(0, 3.0, 0.2); g.add(sign);
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
// ライトリグ: スポット＋漏れ光（点光源）＋光錐メッシュ（子はワールド座標で直接置く）
const _coneGeo = new THREE.ConeGeometry(3.4, 9, 20, 1, true); _coneGeo.translate(0, -4.5, 0); // 頂点を原点に
const _down = new THREE.Vector3(0, -1, 0);
function makeRig(color, spotIntensity, pointIntensity, coneOpacity) {
  const spot = new THREE.SpotLight(color, spotIntensity, 34, 0.62, 0.55, 1.1);
  const point = new THREE.PointLight(color, pointIntensity, 8.5, 1.4);
  const cone = new THREE.Mesh(_coneGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: coneOpacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(spot); scene.add(spot.target); scene.add(point); scene.add(cone);
  return { spot, point, cone };
}
const hunterRig = makeRig(0xff3030, 130, 10, 0.09);   // ハンター: 赤ライト常時点灯
const intruderRig = makeRig(0xffe8c0, 190, 9, 0.05); // 侵入者: 温白色・任意ON/OFF
function aimRig(rig, p, isSelf) {
  const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  rig.spot.position.set(p.x, 1.6, p.z);
  rig.spot.target.position.set(p.x + fx * 10, 1.1, p.z + fz * 10);
  rig.point.position.set(p.x, 1.5, p.z);
  rig.cone.position.set(p.x, 1.55, p.z);
  rig.cone.quaternion.setFromUnitVectors(_down, new THREE.Vector3(fx, -0.06, fz).normalize());
  rig.cone.visible = !isSelf;
}

// ---- 入力 ----
const input = { moveX: 0, moveZ: 0, action: false, dash: false, crouchToggle: false, lightToggle: false };
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyC') input.crouchToggle = true; if (e.code === 'KeyF') input.lightToggle = true; if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => keys[e.code] = false);
let yaw = 0, pitch = 0, pointerLocked = false;
renderer.domElement.addEventListener('click', () => { if (playing && !isTouch) renderer.domElement.requestPointerLock?.(); });
document.addEventListener('pointerlockchange', () => pointerLocked = document.pointerLockElement === renderer.domElement);
addEventListener('mousemove', e => { if (pointerLocked) { yaw += e.movementX * 0.0032; pitch = Math.max(-1.2, Math.min(1.2, pitch - e.movementY * 0.0032)); } });
const isTouch = matchMedia('(pointer: coarse)').matches;
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
bindHold('btnLight', () => input.lightToggle = true);

// ---- ゲーム進行 ----
let st = null, playerRole = 'intruder', botMemH = {}, botMemI = {}, playing = false;
function notice(text, ms = 1800) { const n = $('notice'); n.textContent = text; n.style.opacity = 1; clearTimeout(notice.t); notice.t = setTimeout(() => n.style.opacity = 0, ms); }
function beginPlay(role) {
  playerRole = role; playing = true; hostEvents = []; guestEventCount = 0;
  const me = role === 'intruder' ? st.intruder : st.hunter; yaw = me.yaw; pitch = 0;
  $('titleScreen').classList.add('hidden'); $('endScreen').classList.add('hidden'); $('gameHud').classList.remove('hidden');
  $('roleLabel').textContent = role === 'intruder' ? '🕵️ 侵入者' : '🔦 ハンター';
  $('btnDash').style.display = role === 'intruder' ? 'flex' : 'none';
  $('btnCrouch').style.display = role === 'intruder' ? 'flex' : 'none';
  $('btnLight').style.display = role === 'intruder' ? 'flex' : 'none';
  $('btnAction').textContent = role === 'intruder' ? '操作' : '捕獲';
  notice(role === 'intruder' ? '病院に潜入。端末を探して2台起動し、南の玄関から脱出' : '赤ライトで病院を守れ。端末の反応を頼りに捕まえろ', 3000);
}
function startMatch(role) { st = createState(); botMemH = {}; botMemI = {}; beginPlay(role); }
function endMatch() {
  playing = false; document.exitPointerLock?.();
  const win = (st.phase === 'intruder_win') === (playerRole === 'intruder');
  $('endTitle').textContent = st.phase === 'intruder_win' ? '侵入者の脱出成功' : (st.reason === 'capture' ? 'ハンターが捕獲' : '時間切れ｜ハンターの守備成功');
  $('endDetail').textContent = (win ? 'あなたの勝ち。' : 'あなたの負け。') + `\n経過 ${st.t.toFixed(0)}秒／起動 ${st.devices.filter(d => d.done).length}台／発見 ${st.knownDevices.length}台`;
  $('gameHud').classList.add('hidden'); $('endScreen').classList.remove('hidden');
}
const brightRange = $('brightRange');
if (brightRange) brightRange.addEventListener('input', () => { const v = Number(brightRange.value) / 100; ambLight.intensity = 1.25 * v; hemiLight.intensity = 0.7 * v; });
$('playIntruder').onclick = () => { mode = 'offline'; startMatch('intruder'); };
$('playHunter').onclick = () => { mode = 'offline'; startMatch('hunter'); };
$('rematch').onclick = () => { if (mode === 'offline') startMatch(playerRole); else location.reload(); };
$('backTitle').onclick = () => { $('endScreen').classList.add('hidden'); $('titleScreen').classList.remove('hidden'); };
function playerInput() {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const inp = {
    moveX: Math.abs(stickVec.x) > 0.12 ? stickVec.x : s,
    moveZ: Math.abs(stickVec.y) > 0.12 ? -stickVec.y : f,
    yaw, action: input.action || !!keys.Space, dash: input.dash || !!keys.ShiftLeft || !!keys.ShiftRight,
    crouchToggle: input.crouchToggle, lightToggle: input.lightToggle,
  };
  input.crouchToggle = false; input.lightToggle = false;
  return inp;
}
function consumeEvents() {
  for (const ev of st.events.splice(0)) {
    if (mode === 'host') hostEvents.push(ev);
    if (ev.type === 'discovered' && playerRole === 'intruder') notice(`端末を発見：${st.devices[ev.deviceId]?.name || ''}`, 1600);
    if (playerRole === 'hunter' && ev.type === 'ping') notice(`⚠ ${st.devices[ev.deviceId]?.name || '端末'}が反応した`, 2200);
    if (playerRole === 'intruder' && ev.type === 'ping') notice('信号が漏れた…ハンターに伝わった', 1600);
    if (ev.type === 'device_done') notice(`${st.devices[ev.deviceId]?.name || '端末'} 起動完了`, 1600);
    if (ev.type === 'gates_open') notice('玄関ゲートが開いた！', 2200);
  }
}
// ---- オンライン ----
let mode = 'offline';
let net = null, guestInput = { moveX: 0, moveZ: 0, yaw: 0, action: false, dash: false, crouchToggle: false, lightToggle: false };
let hostEvents = [], pubSeq = 0, lastPubAt = 0, guestEventCount = 0, guestTarget = null;
function snapOf() {
  return {
    seq: ++pubSeq, t: +st.t.toFixed(2), timeLeft: +st.timeLeft.toFixed(1), phase: st.phase, reason: st.reason,
    hunter: [+st.hunter.x.toFixed(2), +st.hunter.z.toFixed(2), +st.hunter.yaw.toFixed(2)],
    intruder: [+st.intruder.x.toFixed(2), +st.intruder.z.toFixed(2), +st.intruder.yaw.toFixed(2), st.intruder.crouch ? 1 : 0],
    light: st.intruder.lightOn ? 1 : 0,
    devices: st.devices.map(d => [d.tid, +d.progress.toFixed(1), d.done ? 1 : 0]),
    known: st.knownDevices, gatesOpen: st.gatesOpen, capture: +st.capture.toFixed(2), gateChannel: +st.gateChannel.toFixed(2),
    traces: st.traces.map(t => [+t.x.toFixed(1), +t.z.toFixed(1), +t.ttl.toFixed(1)]),
    hunterKnow: [st.hunterKnow.deviceId, +st.hunterKnow.at.toFixed(1)], events: hostEvents,
  };
}
function applySnap(s) {
  if (!st) { st = createState(1); guestEventCount = 0; }
  st.t = s.t; st.timeLeft = s.timeLeft; st.phase = s.phase; st.reason = s.reason;
  guestTarget = { h: s.hunter, i: s.intruder };
  st.hunter.yaw = s.hunter[2]; st.intruder.yaw = s.intruder[2]; st.intruder.crouch = !!s.intruder[3]; st.intruder.lightOn = !!s.light;
  if (!applySnap.placed) { applySnap.placed = true; st.hunter.x = s.hunter[0]; st.hunter.z = s.hunter[1]; st.intruder.x = s.intruder[0]; st.intruder.z = s.intruder[1]; }
  st.devices = s.devices.map((d, i) => ({ id: i, tid: d[0], x: TERMINALS[d[0]].x, z: TERMINALS[d[0]].z, name: TERMINALS[d[0]].name, progress: d[1], done: !!d[2], charge: 0, pingAt: -1, pinged: false }));
  st.knownDevices = s.known || [];
  st.gatesOpen = s.gatesOpen; st.capture = s.capture; st.gateChannel = s.gateChannel;
  st.traces = s.traces.map(t => ({ x: t[0], z: t[1], ttl: t[2] }));
  st.hunterKnow = { deviceId: s.hunterKnow[0], at: s.hunterKnow[1] };
  const evs = s.events || [];
  for (let i = guestEventCount; i < evs.length; i++) st.events.push(evs[i]);
  guestEventCount = evs.length;
  if (!playing && s.phase === 'play') beginPlay(net.role);
  if (playing && s.phase !== 'play') { render(); endMatch(); }
}
function setupNet() {
  if (net) return net;
  net = createNet({
    onStatus: s => { $('netStatus').textContent = s; },
    onStatus2: s => { if (s) $('netStatus').textContent = '状態: ' + s; },
    onPresence: (me, peer) => { $('netStart').classList.toggle('hidden', !(net.isHost && peer)); if (net.code) $('netStatus').textContent = `部屋 ${net.code}／${peer ? '友達が来ました' : '友達を待っています'}`; },
    onRoomReady: () => {},
    onGuestInput: v => { guestInput = { moveX: v.moveX || 0, moveZ: v.moveZ || 0, yaw: v.yaw || 0, action: !!v.action, dash: !!v.dash, crouchToggle: !!v.crouchToggle, lightToggle: !!v.lightToggle }; },
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
// HUDマーカー
const markerEls = {};
function setMarker(key, world, text, color) {
  let el = markerEls[key];
  if (!el) { el = document.createElement('div'); el.className = 'marker'; $('markers').appendChild(el); markerEls[key] = el; }
  const v = new THREE.Vector3(world.x, 1.9, world.z).project(camera);
  if (v.z > 1 || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px'; el.style.top = (-v.y * 0.5 + 0.5) * innerHeight + 'px';
  el.textContent = text; el.style.borderColor = color;
}
function hideMarker(key) { if (markerEls[key]) markerEls[key].style.display = 'none'; }
// ミニマップ
const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const cw = 200, ch = 150, sx = cw / MW, sz = ch / MH;
  mm.fillStyle = '#081120'; mm.fillRect(0, 0, cw, ch);
  for (let z = 0; z < MAP_ROWS.length; z++) for (let x = 0; x < MAP_ROWS[0].length; x++) {
    const c = MAP_ROWS[z][x];
    if (c === '#') { mm.fillStyle = '#41546e'; mm.fillRect(x * CELL * sx, z * CELL * sz, CELL * sx, CELL * sz); }
    else if (c === 'S') { mm.fillStyle = '#2e4f4a'; mm.fillRect(x * CELL * sx, z * CELL * sz, CELL * sx, CELL * sz); }
    else if (c === 'B') { mm.fillStyle = '#77879c'; mm.fillRect(x * CELL * sx + 1, z * CELL * sz + 1, CELL * sx - 2, CELL * sz - 2); }
  }
  const dot = (wx, wz, color, r = 3) => { mm.fillStyle = color; mm.beginPath(); mm.arc(wx * sx, wz * sz, r, 0, 7); mm.fill(); };
  for (const g of GATES) dot(g.x, g.z, st.gatesOpen ? '#39e6a3' : '#7d8ea8', 3.5);
  if (playerRole === 'hunter') for (const d of st.devices) dot(d.x, d.z, d.done ? '#39e6a3' : '#ffb347', 3);
  else for (const d of st.devices) if (st.knownDevices.includes(d.id)) dot(d.x, d.z, d.done ? '#39e6a3' : '#57d7ff', 3);
  if (playerRole === 'hunter' && st.hunterKnow.deviceId >= 0 && st.t - st.hunterKnow.at < 12) { const d = st.devices[st.hunterKnow.deviceId]; if (d) { mm.strokeStyle = '#ff5d5d'; mm.lineWidth = 2; mm.beginPath(); mm.arc(d.x * sx, d.z * sz, 5 + Math.sin(performance.now() / 150) * 1.5, 0, 7); mm.stroke(); } }
  const me = playerRole === 'intruder' ? st.intruder : st.hunter;
  mm.save(); mm.translate(me.x * sx, me.z * sz); mm.rotate(Math.atan2(Math.sin(me.yaw), -Math.cos(me.yaw)) + Math.PI);
  mm.fillStyle = '#fff'; mm.beginPath(); mm.moveTo(0, -5); mm.lineTo(3.4, 4); mm.lineTo(-3.4, 4); mm.closePath(); mm.fill(); mm.restore();
}
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
  foeMesh.rotation.y = -foe.yaw;
  camera.position.set(me.x, (me === st.intruder && st.intruder.crouch) ? 1.05 : 1.62, me.z);
  camera.rotation.set(0, 0, 0); camera.rotation.order = 'YXZ'; camera.rotation.y = -yaw; camera.rotation.x = pitch;
  // ライト
  const myP = { x: me.x, z: me.z, yaw };
  if (playerRole === 'hunter') { aimRig(hunterRig, myP, true); hunterRig.spot.visible = true; hunterRig.point.visible = true; aimRig(intruderRig, { x: foe.x, z: foe.z, yaw: foe.yaw }, false); intruderRig.spot.visible = intruderRig.point.visible = st.intruder.lightOn; intruderRig.cone.visible = st.intruder.lightOn; }
  else { aimRig(intruderRig, myP, true); intruderRig.spot.visible = intruderRig.point.visible = st.intruder.lightOn; aimRig(hunterRig, { x: foe.x, z: foe.z, yaw: foe.yaw }, false); hunterRig.spot.visible = hunterRig.point.visible = true; hunterRig.cone.visible = true; }
  scene.fog.far = playerRole === 'hunter' ? 32 : (st.intruder.lightOn ? 30 : 13);
  // 端末の見た目: 有効端末のみ画面が光る
  for (const tm of termMeshes) {
    const dev = st.devices.find(dv => dv.x === tm.group.position.x && dv.z === tm.group.position.z);
    tm.scr.material.color.set(!dev ? 0x10161f : dev.done ? 0x39e6a3 : (dev.progress > 0 ? 0xffd257 : 0xffb347));
    tm.bar.scale.x = dev ? Math.max(0.001, dev.progress / CFG.deviceTime) : 0.001;
  }
  gateMeshes.forEach(m => { m.lamp.material.color.set(st.gatesOpen ? 0x39e6a3 : 0xff4444); m.door.position.x = st.gatesOpen ? 0.85 : 0; });
  st.traces.forEach((tr, i) => { if (i < tracePool.length) { const m = tracePool[i]; m.position.x = tr.x; m.position.z = tr.z; m.material.opacity = Math.min(0.55, tr.ttl / CFG.traceLife * 0.55); } });
  for (let i = st.traces.length; i < tracePool.length; i++) tracePool[i].material.opacity = 0;
  renderer.render(scene, camera);
  if (!playing) return;
  const tl = Math.max(0, st.timeLeft);
  $('timer').textContent = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  const done = st.devices.filter(d => d.done).length;
  $('devCount').textContent = playerRole === 'hunter' ? `端末 ${done}/2 起動済` : `発見 ${st.knownDevices.length}台／起動 ${done}/2`;
  $('objective').textContent = playerRole === 'intruder' ? (st.gatesOpen ? '南の玄関から脱出（操作長押し）' : '端末を探して2台起動せよ（ライトは見つけやすいがバレる）') : (st.gatesOpen ? '玄関ゲートを守れ！' : '端末を守り、侵入者を捕獲せよ');
  let prog = -1;
  if (playerRole === 'intruder') { const d = st.devices.find(d => !d.done && dist(me, d) < CFG.interactRange); if (d) prog = d.progress / CFG.deviceTime; if (st.gatesOpen && GATES.some(g => dist(me, g) < CFG.interactRange)) prog = st.gateChannel / CFG.gateTime; }
  else if (st.capture > 0) prog = st.capture / CFG.captureTime;
  $('progressWrap').style.display = prog >= 0 ? 'block' : 'none';
  if (prog >= 0) $('progressBar').style.width = Math.min(100, prog * 100) + '%';
  if (playerRole === 'intruder') {
    const d = dist(me, foe);
    $('vignette').style.opacity = d < CFG.proximityRange ? String(Math.min(0.9, (1 - d / CFG.proximityRange) * 1.15)) : '0';
    const ar = $('proxArrow');
    if (d < CFG.proximityRange) { const rel = Math.atan2(foe.x - me.x, -(foe.z - me.z)) - yaw; ar.style.display = 'block'; ar.style.transform = `translate(-50%,-50%) rotate(${rel}rad) translateY(-64px)`; }
    else ar.style.display = 'none';
    st.devices.forEach(dev => { if (st.knownDevices.includes(dev.id)) setMarker('dev' + dev.tid, dev, dev.done ? `${dev.name} ✓` : `${dev.name} ${Math.floor(dev.progress / CFG.deviceTime * 100)}%`, dev.done ? '#39e6a3' : '#57d7ff'); else hideMarker('dev' + dev.tid); });
    TERMINALS.forEach(t => { if (!st.devices.some(d => d.tid === t.tid)) hideMarker('dev' + t.tid); });
    GATES.forEach((g, i) => setMarker('gate' + i, g, st.gatesOpen ? '玄関ゲート（開）' : '玄関ゲート', st.gatesOpen ? '#39e6a3' : '#8899bb'));
  } else {
    $('vignette').style.opacity = '0'; $('proxArrow').style.display = 'none';
    st.devices.forEach(dev => setMarker('dev' + dev.tid, dev, (st.hunterKnow.deviceId === dev.id && st.t - st.hunterKnow.at < 12 ? '⚠' : '') + dev.name + (dev.done ? ' 起動済' : ''), dev.done ? '#39e6a3' : '#ffb347'));
    GATES.forEach((g, i) => setMarker('gate' + i, g, st.gatesOpen ? '玄関ゲート（開）' : '玄関ゲート', st.gatesOpen ? '#ff5d5d' : '#8899bb'));
  }
  drawMinimap();
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
requestAnimationFrame(frame);
window.StealthGame = { startMatch, get state() { return st; }, setYaw(v) { yaw = v; }, input, THREE, scene, camera };
