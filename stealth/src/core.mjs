// 3D潜入1vs1 コアロジック v2（描画なし）。ブラウザとNodeシミュレーションで共用。
// 病院マップ 64m×48m。座標: x=東, z=南 (メートル)。yaw: 0=-z(北), 時計回り正。セル幅2m。
// セル文字: #=壁, S=背の高い棚（視線も遮る）, B=低い遮蔽（ベッド等・しゃがむと視線を遮る）, D=端末候補, G=ゲート, H/I=スポーン
export const CELL = 2;
export const MAP_ROWS = [
  '################################',
  '#I........#..........#.........#',
  '#.B.B.B...#..B.B.B...#..B.B.B..#',
  '#.........#.S........#.......D.#',
  '#.............B......#.........#',
  '#.B.B.B...#....................#',
  '#.........#..B.B.....#..B...B..#',
  '#....D....#........S.#.........#',
  '#.........#..........#.....#...#',
  '####.###########.#########.#####',
  '#.........#....#.....#.........#',
  '#.S....S..#..SSS.SSS.#..SB.....#',
  '#..B......#..S.....S.........S.#',
  '#.S.D........SS.D.SS.#......D..#',
  '#..B......#..S.....S.#...B.B...#',
  '#.S...BS..#..SSS.SSS.#.......S.#',
  '#.........#.....#....#.........#',
  '#####.##########.########.######',
  '#........#............#........#',
  '#....S...#..B......B...........#',
  '#..D...........B......#....S...#',
  '#....B...#......H.....#...B....#',
  '#.....G..#.....##.....#..G.....#',
  '################################',
];
export const W = MAP_ROWS[0].length, H = MAP_ROWS.length;
export const CFG = {
  matchTime: 240,
  hunterSpeed: 5.2, intruderSpeed: 4.7, crouchSpeed: 2.4,
  dashSpeed: 7.6, dashTime: 0.7, dashCooldown: 6,
  radius: 0.35,
  deviceTime: 7, devicesNeeded: 2, activeDevices: 4,
  pingChargeTime: 3, pingDelay: 4,
  captureRange: 2.3, captureTime: 0.6, captureStagger: 0.8, spawnProtect: 5,
  gateTime: 0.5, interactRange: 1.9,
  traceLife: 6, restealthTime: 5,
  proximityRange: 12,
  discoverRange: 6, discoverRangeLit: 9,
  visionRange: 14, visionRangeLit: 26,
};
export const ZONES = [
  { name: '病棟A', x0: 1, z0: 1, x1: 9, z1: 8, color: 0x2c4a63 },
  { name: '病棟B', x0: 11, z0: 1, x1: 20, z1: 8, color: 0x2c4a63 },
  { name: '病棟C', x0: 22, z0: 1, x1: 30, z1: 8, color: 0x2c4a63 },
  { name: '薬局', x0: 1, z0: 10, x1: 9, z1: 16, color: 0x3a5a48 },
  { name: 'ナースステーション', x0: 11, z0: 10, x1: 20, z1: 16, color: 0x54503a },
  { name: '手術室', x0: 22, z0: 10, x1: 30, z1: 16, color: 0x54405a },
  { name: '設備室', x0: 1, z0: 18, x1: 8, z1: 22, color: 0x4a4a52 },
  { name: 'ロビー', x0: 10, z0: 18, x1: 21, z1: 22, color: 0x63553a },
  { name: '警備室', x0: 23, z0: 18, x1: 30, z1: 22, color: 0x5a3238 },
];
function cellAt(cx, cz) { if (cx < 0 || cz < 0 || cx >= W || cz >= H) return '#'; return MAP_ROWS[cz][cx]; }
export function cellAtWorld(wx, wz) { return cellAt(Math.floor(wx / CELL), Math.floor(wz / CELL)); }
export function isWall(wx, wz) { const c = cellAtWorld(wx, wz); return c === '#' || c === 'S'; } // 視線・移動を完全に遮る
export function isBlocked(wx, wz) { const c = cellAtWorld(wx, wz); return c === '#' || c === 'S' || c === 'B'; } // 移動を遮る
function findCells(ch) { const out = []; for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (MAP_ROWS[z][x] === ch) out.push({ x: x * CELL + 1, z: z * CELL + 1 }); return out; }
export const TERMINALS = findCells('D').map((p, i) => ({ tid: i, x: p.x, z: p.z, name: ['酸素供給装置', '病棟端末', '薬局端末', '医療端末', '手術室端末', '配電盤'][i] }));
export const GATES = findCells('G');
const SPAWNS = { intruder: findCells('I')[0], hunter: findCells('H')[0] };

export function losClear(x1, z1, x2, z2, targetCrouch = false) {
  const dx = x2 - x1, dz = z2 - z1, dist_ = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(dist_ / 0.2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps, c = cellAtWorld(x1 + dx * t, z1 + dz * t);
    if (c === '#' || c === 'S') return false;
    if (c === 'B' && targetCrouch) return false; // しゃがんだ相手は低い遮蔽で隠れる
  }
  return true;
}
export function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function createState(seed) {
  const rng = mulberry32(seed === undefined ? (Math.random() * 1e9) | 0 : seed);
  const tids = TERMINALS.map(t => t.tid);
  for (let i = tids.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0;[tids[i], tids[j]] = [tids[j], tids[i]]; }
  const active = tids.slice(0, CFG.activeDevices).sort((a, b) => a - b);
  return {
    t: 0, timeLeft: CFG.matchTime, phase: 'play', reason: '', seed,
    hunter: { x: SPAWNS.hunter.x, z: SPAWNS.hunter.z, yaw: 0, stagger: 0, captureCd: 0 },
    intruder: { x: SPAWNS.intruder.x, z: SPAWNS.intruder.z, yaw: Math.PI, crouch: false, dashT: 0, dashCd: 0, unseen: 99, lightOn: false },
    devices: active.map((tid, i) => ({ id: i, tid, x: TERMINALS[tid].x, z: TERMINALS[tid].z, name: TERMINALS[tid].name, progress: 0, done: false, charge: 0, pingAt: -1, pinged: false })),
    knownDevices: [], // 侵入者が発見済みの device id
    gatesOpen: false,
    capture: 0, gateChannel: 0,
    traces: [], events: [],
    hunterKnow: { deviceId: -1, at: -99 },
    metrics: { firstPingAt: -1, firstDeviceAt: -1, doneAt: -1, captureAt: -1, seenTime: 0, discoveredAt: -1 },
  };
}
function moveCircle(p, dx, dz) {
  let nx = p.x + dx; if (!isBlocked(nx + Math.sign(dx) * CFG.radius, p.z) && !isBlocked(nx + Math.sign(dx) * CFG.radius, p.z - CFG.radius * 0.8) && !isBlocked(nx + Math.sign(dx) * CFG.radius, p.z + CFG.radius * 0.8)) p.x = nx;
  let nz = p.z + dz; if (!isBlocked(p.x, nz + Math.sign(dz) * CFG.radius) && !isBlocked(p.x - CFG.radius * 0.8, nz + Math.sign(dz) * CFG.radius) && !isBlocked(p.x + CFG.radius * 0.8, nz + Math.sign(dz) * CFG.radius)) p.z = nz;
}
function applyMove(p, input, speed, dt) {
  const mx = input.moveX || 0, mz = input.moveZ || 0;
  const len = Math.hypot(mx, mz); if (len < 0.01) return false;
  const s = Math.min(1, len), vx = mx / (len || 1) * s, vz = mz / (len || 1) * s;
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const wx = cos * vx + sin * vz, wz = sin * vx - cos * vz;
  moveCircle(p, wx * speed * dt, wz * speed * dt);
  return true;
}
const idle = () => ({ moveX: 0, moveZ: 0, action: false, dash: false, crouchToggle: false, lightToggle: false });
export function seesHunter(st) { // ハンターが侵入者を視認しているか
  const hu = st.hunter, it = st.intruder, d = dist(hu, it);
  const range = it.lightOn ? CFG.visionRangeLit : (it.crouch ? CFG.visionRange - 3 : CFG.visionRange);
  if (d >= range) return false;
  if (!losClear(hu.x, hu.z, it.x, it.z, it.crouch)) return false;
  return angleDiff(aimYaw(hu, it), hu.yaw) < 1.25;
}
export function step(st, inputs, dt) {
  if (st.phase !== 'play') return st;
  const hi = inputs.hunter || idle(), ii = inputs.intruder || idle();
  st.t += dt; st.timeLeft = CFG.matchTime - st.t;
  const hu = st.hunter, it = st.intruder;
  hu.yaw = hi.yaw ?? hu.yaw; it.yaw = ii.yaw ?? it.yaw;
  if (ii.crouchToggle) it.crouch = !it.crouch;
  if (ii.lightToggle) it.lightOn = !it.lightOn;
  it.dashCd = Math.max(0, it.dashCd - dt);
  if (ii.dash && it.dashCd <= 0 && it.dashT <= 0) { it.dashT = CFG.dashTime; it.dashCd = CFG.dashCooldown; }
  const dashing = it.dashT > 0; if (dashing) it.dashT -= dt;
  hu.stagger = Math.max(0, hu.stagger - dt);
  if (hu.stagger <= 0) applyMove(hu, hi, CFG.hunterSpeed, dt);
  const iSpeed = dashing ? CFG.dashSpeed : (it.crouch ? CFG.crouchSpeed : CFG.intruderSpeed);
  const moved = applyMove(it, ii, iSpeed, dt);
  if (dashing && moved) { const last = st.traces[st.traces.length - 1]; if (!last || Math.hypot(last.x - it.x, last.z - it.z) > 0.9) st.traces.push({ x: it.x, z: it.z, ttl: CFG.traceLife }); }
  st.traces = st.traces.filter(tr => (tr.ttl -= dt) > 0);
  // 端末の発見（侵入者）: 近づいて視線が通れば発見。ライト点灯中は遠くからでも
  for (const d of st.devices) {
    if (d.done || st.knownDevices.includes(d.id)) continue;
    const range = it.lightOn ? CFG.discoverRangeLit : CFG.discoverRange;
    if (dist(it, d) < range && losClear(it.x, it.z, d.x, d.z)) { st.knownDevices.push(d.id); st.events.push({ type: 'discovered', deviceId: d.id, t: st.t }); if (st.metrics.discoveredAt < 0) st.metrics.discoveredAt = st.t; }
  }
  const seen = seesHunter(st);
  if (seen) { it.unseen = 0; st.metrics.seenTime += dt; } else it.unseen += dt;
  // 装置操作
  let channeling = null;
  if (ii.action && !dashing) for (const d of st.devices) { if (!d.done && dist(it, d) < CFG.interactRange) { channeling = d; break; } }
  if (channeling) {
    if (!st.knownDevices.includes(channeling.id)) st.knownDevices.push(channeling.id);
    channeling.progress += dt; channeling.charge += dt;
    if (!channeling.pinged && channeling.charge >= CFG.pingChargeTime && channeling.pingAt < 0) channeling.pingAt = st.t + CFG.pingDelay;
    if (channeling.progress >= CFG.deviceTime && !channeling.done) {
      channeling.done = true; st.events.push({ type: 'device_done', deviceId: channeling.id, t: st.t });
      if (st.metrics.firstDeviceAt < 0) st.metrics.firstDeviceAt = st.t;
      const doneCount = st.devices.filter(d => d.done).length;
      if (doneCount >= CFG.devicesNeeded && !st.gatesOpen) { st.gatesOpen = true; st.metrics.doneAt = st.t; st.events.push({ type: 'gates_open', t: st.t }); }
    }
  }
  for (const d of st.devices) if (d.pingAt > 0 && st.t >= d.pingAt) { d.pingAt = -1; d.pinged = true; st.hunterKnow = { deviceId: d.id, at: st.t }; st.events.push({ type: 'ping', deviceId: d.id, t: st.t }); if (st.metrics.firstPingAt < 0) st.metrics.firstPingAt = st.t; }
  // 脱出
  let gateNow = false;
  if (st.gatesOpen && ii.action) for (const g of GATES) if (dist(it, g) < CFG.interactRange) { gateNow = true; break; }
  st.gateChannel = gateNow ? st.gateChannel + dt : 0;
  if (st.gateChannel >= CFG.gateTime) { st.phase = 'intruder_win'; st.reason = 'escape'; }
  // 捕獲
  const dHI = dist(hu, it);
  const canCapture = st.t >= CFG.spawnProtect && hu.stagger <= 0 && dHI < CFG.captureRange && losClear(hu.x, hu.z, it.x, it.z, it.crouch) && angleDiff(aimYaw(hu, it), hu.yaw) < 1.5;
  if (hi.action && canCapture) {
    st.capture += dt;
    if (st.capture >= CFG.captureTime) { st.phase = 'hunter_win'; st.reason = 'capture'; st.metrics.captureAt = st.t; }
  } else {
    if (st.capture > 0 && hi.action) { hu.stagger = CFG.captureStagger; }
    st.capture = 0;
  }
  if (st.phase === 'play' && st.timeLeft <= 0) { st.phase = 'hunter_win'; st.reason = 'timeout'; }
  return st;
}
export function aimYaw(from, to) { return Math.atan2(to.x - from.x, -(to.z - from.z)); }
export function angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); }
export function facing(yaw) { return { x: Math.sin(yaw), z: -Math.cos(yaw) }; }

// ---- グリッドBFS ----
export function bfsPath(sx, sz, tx, tz) {
  const s = { cx: Math.floor(sx / CELL), cz: Math.floor(sz / CELL) }, g = { cx: Math.floor(tx / CELL), cz: Math.floor(tz / CELL) };
  const key = (x, z) => x + ',' + z; const prev = new Map([[key(s.cx, s.cz), null]]); const q = [s];
  while (q.length) { const c = q.shift(); if (c.cx === g.cx && c.cz === g.cz) { const path = []; let k = key(c.cx, c.cz), cur = c; while (k) { path.unshift({ x: cur.cx * CELL + 1, z: cur.cz * CELL + 1 }); const p = prev.get(k); if (!p) break; cur = p; k = key(p.cx, p.cz); } return path; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = c.cx + dx, nz = c.cz + dz, k = key(nx, nz); if (prev.has(k)) continue; const cell = cellAt(nx, nz); if (cell === '#' || cell === 'B' || cell === 'S') continue; prev.set(k, c); q.push({ cx: nx, cz: nz }); } }
  return null;
}
function inputToward(p, target) {
  const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.5) return { input: idle(), arrived: true };
  const wantYaw = Math.atan2(dx, -dz);
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const fwd = { x: sin, z: -cos }, right = { x: cos, z: sin };
  const ux = dx / d, uz = dz / d;
  return { input: { moveX: ux * right.x + uz * right.z, moveZ: ux * fwd.x + uz * fwd.z, yaw: wantYaw, action: false, dash: false }, arrived: false };
}
function followPath(p, path, lookTarget) {
  if (!path || path.length === 0) return idle();
  let wp = path[0]; if (Math.hypot(wp.x - p.x, wp.z - p.z) < 0.7 && path.length > 1) { path.shift(); wp = path[0]; }
  const r = inputToward(p, wp); if (lookTarget) r.input.yaw = Math.atan2(lookTarget.x - p.x, -(lookTarget.z - p.z)); return r.input;
}

// ---- BOT ----
export function botIntruder(st, mem) {
  const it = st.intruder, hu = st.hunter;
  mem.path = mem.path || null; mem.retarget = mem.retarget || 0; mem.checked = mem.checked || {};
  const dH = dist(it, hu);
  const seesMe = seesHunter(st);
  // 端末候補の現地確認（3m以内で有効/無効が分かる）
  for (const t of TERMINALS) if (mem.checked[t.tid] === undefined && dist(it, t) < 3) mem.checked[t.tid] = st.devices.some(d => d.tid === t.tid);
  const setLight = (want) => it.lightOn !== want;
  // ゲート目前なら突っ込む
  if (st.gatesOpen) { const g = GATES.slice().sort((a, b) => dist(it, a) - dist(it, b))[0]; if (dist(it, g) < CFG.interactRange - 0.2) { const a = idle(); a.action = true; a.yaw = Math.atan2(g.x - it.x, -(g.z - it.z)); return a; } if (dist(it, g) < 8 && dH > 2.8) { const inp = followPath(it, (bfsPath(it.x, it.z, g.x, g.z) || []).slice(1), g); if (setLight(false)) inp.lightToggle = true; return inp; } }
  // 逃走
  if ((seesMe && dH < 9) || dH < 5) {
    mem.fleeT = (mem.fleeT || 0) - 1;
    if (!mem.fleeTarget || mem.fleeT <= 0) {
      let best = null, bestScore = -1e9;
      for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2, tx = it.x + Math.sin(ang) * 7, tz = it.z - Math.cos(ang) * 7; if (isBlocked(tx, tz)) continue; const hp = bfsPath(hu.x, hu.z, tx, tz); if (!hp) continue; const score = hp.length * 2 + (losClear(tx, tz, hu.x, hu.z, false) ? 0 : 5) - Math.hypot(tx - it.x, tz - it.z) * 0.3; if (score > bestScore) { bestScore = score; best = { x: tx, z: tz }; } }
      mem.fleeTarget = best; mem.fleeT = 6; mem.path = best ? bfsPath(it.x, it.z, best.x, best.z) : null;
    }
    if (mem.fleeTarget) { const inp = followPath(it, mem.path && mem.path.slice(), hu); inp.dash = dH < 4.5; inp.yaw = Math.atan2(it.x - hu.x, -(it.z - hu.z)) + Math.PI; if (setLight(false)) inp.lightToggle = true; return inp; }
  } else mem.fleeTarget = null;
  // 目標決定: 発見済みの有効端末 > 未確認の候補（探索）
  let target = null;
  const known = st.devices.filter(d => !d.done && st.knownDevices.includes(d.id));
  if (known.length) { const leaked = st.devices.find(d => !d.done && d.pinged && d.progress < CFG.deviceTime * 0.5 && st.hunterKnow.deviceId === d.id && st.t - st.hunterKnow.at < 12); const pool = known.filter(d => !leaked || d.id !== leaked.id); target = (pool[0] || known[0]) && { ...(pool[0] || known[0]), kind: 'device' }; }
  if (!target && st.gatesOpen) target = { ...GATES.slice().sort((a, b) => dist(it, a) - dist(it, b))[0], kind: 'gate' };
  if (!target) {
    const unchecked = TERMINALS.filter(t => mem.checked[t.tid] === undefined);
    const cands = (unchecked.length ? unchecked : TERMINALS.filter(t => mem.checked[t.tid])).slice().sort((a, b) => dist(it, a) - dist(it, b));
    if (cands[0]) target = { ...cands[0], kind: 'search' };
  }
  if (!target) return idle();
  const dT = dist(it, target);
  if (target.kind === 'device' && dT < CFG.interactRange - 0.3) { const inp = idle(); inp.action = true; inp.yaw = Math.atan2(target.x - it.x, -(target.z - it.z)); if (setLight(false)) inp.lightToggle = true; return inp; }
  // 警戒: ハンター中距離＋視線ありなら物陰で待つ（後半は待たない）
  if (target.kind === 'device' && st.t < 170 && dH < 10 && dH > 5 && losClear(it.x, it.z, hu.x, hu.z)) { const inp = idle(); if (!it.crouch) inp.crouchToggle = true; inp.yaw = Math.atan2(hu.x - it.x, -(hu.z - it.z)); return inp; }
  mem.retarget -= 1;
  if (!mem.path || mem.retarget <= 0) { mem.path = bfsPath(it.x, it.z, target.x, target.z); mem.retarget = 30; }
  const inp = followPath(it, mem.path ? mem.path.slice(1) : null, target);
  if (it.crouch) inp.crouchToggle = true;
  // 探索中はライトON（見つけやすいがバレやすい）、ハンターが近いときはOFF
  const wantLight = dH > 13 && target.kind === 'search';
  if (setLight(wantLight)) inp.lightToggle = true;
  return inp;
}
export function botHunter(st, mem) {
  const hu = st.hunter, it = st.intruder;
  mem.path = mem.path || null; mem.retarget = mem.retarget || 0;
  const dI = dist(hu, it);
  const sees = seesHunter(st);
  const lightSpotted = it.lightOn && dI < 30 && losClear(hu.x, hu.z, it.x, it.z, it.crouch);
  if (sees || (lightSpotted && dI < 18)) mem.lkp = { x: it.x, z: it.z, at: st.t };
  let target = null, capture = false;
  if (sees || (mem.lkp && st.t - mem.lkp.at < 6 && dI < 12)) { target = sees ? { x: it.x, z: it.z } : mem.lkp; if (sees && dI < CFG.captureRange) capture = true; }
  else if (st.gatesOpen) { mem.gatePatrol = mem.gatePatrol || 0; mem.gateT = (mem.gateT || 0) + 1; if (mem.gateT > 120) { mem.gatePatrol++; mem.gateT = 0; } target = { ...GATES[mem.gatePatrol % GATES.length] }; if (dist(hu, target) < 2.2 && mem.gateT < 100) mem.gateT = 100; }
  else if (st.hunterKnow.deviceId >= 0 && st.t - st.hunterKnow.at < 25) { if (mem.knowAt !== st.hunterKnow.at) { mem.knowAt = st.hunterKnow.at; mem.reactUntil = st.t + 0.9; } if (st.t < mem.reactUntil) { const inp = idle(); inp.yaw = hu.yaw + 0.03; return inp; } const d = st.devices[st.hunterKnow.deviceId]; target = { x: d.x, z: d.z }; }
  else { const devs = st.devices; if (mem.patrolInit === undefined) { mem.patrolInit = 1; mem.patrol = Math.floor((mem.rng || Math.random)() * devs.length); } target = devs[mem.patrol % devs.length]; if (dist(hu, target) < 1.5) mem.patrol++; }
  if (!target) return idle();
  mem.retarget -= 1;
  if (!mem.path || mem.retarget <= 0) { mem.path = bfsPath(hu.x, hu.z, target.x, target.z); mem.retarget = 20; }
  const inp = followPath(hu, mem.path ? mem.path.slice(1) : null, sees ? it : target);
  if (capture) { inp.action = true; inp.moveX = 0; inp.moveZ = 0; inp.yaw = Math.atan2(it.x - hu.x, -(it.z - hu.z)); }
  return inp;
}
