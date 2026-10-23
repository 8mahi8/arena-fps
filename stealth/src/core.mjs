// 3D潜入1vs1 コアロジック（描画なし）。ブラウザとNodeシミュレーションで共用する。
// 座標: x=東, z=南 (メートル)。yaw: 0=-z(北), 時計回り正。セル幅2m。
export const CELL = 2;
export const MAP_ROWS = [
  '#####################',
  '#I....#.......#.....#',
  '#..........D...#..D..#',
  '#..#...........#.....#',
  '#..#.....##.###..#..#',
  '#.....#.......#.....#',
  '#.D........#...#..#..#',
  '#.....#...#......#..#',
  '#..#......#.........#',
  '#..#..##.....#......#',
  '#.....##..#......#..#',
  '#..D..........#......#',
  '#.....#.......#.....#',
  '#..G..#...H...#..G..#',
  '#####################',
];
export const W = MAP_ROWS[0].length, H = MAP_ROWS.length;
export const CFG = {
  matchTime: 180,
  hunterSpeed: 5.2, intruderSpeed: 4.7, crouchSpeed: 2.4,
  dashSpeed: 7.6, dashTime: 0.7, dashCooldown: 6,
  radius: 0.35,
  deviceTime: 8, devicesNeeded: 2,
  pingChargeTime: 3, pingDelay: 4,
  captureRange: 2.3, captureTime: 0.6, captureStagger: 0.8, spawnProtect: 5,
  gateTime: 0.5, interactRange: 1.9,
  traceLife: 6, restealthTime: 5,
  proximityRange: 12,
};
function cellAt(cx, cz) { if (cx < 0 || cz < 0 || cx >= W || cz >= H) return '#'; return MAP_ROWS[cz][cx]; }
export function isWall(wx, wz) { return cellAt(Math.floor(wx / CELL), Math.floor(wz / CELL)) === '#'; }
function findCells(ch) { const out = []; for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (MAP_ROWS[z][x] === ch) out.push({ x: x * CELL + 1, z: z * CELL + 1 }); return out; }
export const DEVICES = findCells('D');
export const GATES = findCells('G');
const SPAWNS = { intruder: findCells('I')[0], hunter: findCells('H')[0] };

export function losClear(x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, dist = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(dist / 0.2));
  for (let i = 1; i < steps; i++) { const t = i / steps; if (isWall(x1 + dx * t, z1 + dz * t)) return false; }
  return true;
}
export function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

export function createState() {
  return {
    t: 0, timeLeft: CFG.matchTime, phase: 'play', reason: '',
    hunter: { x: SPAWNS.hunter.x, z: SPAWNS.hunter.z, yaw: 0, stagger: 0, captureCd: 0 },
    intruder: { x: SPAWNS.intruder.x, z: SPAWNS.intruder.z, yaw: Math.PI, crouch: false, dashT: 0, dashCd: 0, unseen: 99 },
    devices: DEVICES.map((d, i) => ({ id: i, x: d.x, z: d.z, progress: 0, done: false, charge: 0, pingAt: -1, pinged: false })),
    gatesOpen: false,
    capture: 0, gateChannel: 0,
    traces: [], events: [],
    hunterKnow: { deviceId: -1, at: -99 }, // ハンターが最後に得た装置情報
    metrics: { firstPingAt: -1, firstDeviceAt: -1, doneAt: -1, captureAt: -1, seenTime: 0, chaseTime: 0 },
  };
}
function moveCircle(p, dx, dz) {
  let nx = p.x + dx; if (!isWall(nx + Math.sign(dx) * CFG.radius, p.z) && !isWall(nx + Math.sign(dx) * CFG.radius, p.z - CFG.radius * 0.8) && !isWall(nx + Math.sign(dx) * CFG.radius, p.z + CFG.radius * 0.8)) p.x = nx;
  let nz = p.z + dz; if (!isWall(p.x, nz + Math.sign(dz) * CFG.radius) && !isWall(p.x - CFG.radius * 0.8, nz + Math.sign(dz) * CFG.radius) && !isWall(p.x + CFG.radius * 0.8, nz + Math.sign(dz) * CFG.radius)) p.z = nz;
}
function applyMove(p, input, speed, dt) {
  const mx = input.moveX || 0, mz = input.moveZ || 0; // mz: +1=前進
  const len = Math.hypot(mx, mz); if (len < 0.01) return false;
  const s = Math.min(1, len), vx = mx / (len || 1) * s, vz = mz / (len || 1) * s;
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  // yaw=0 で前進=-z。fwd=(sin,-cos), right=(cos,sin)
  const wx = cos * vx + sin * vz, wz = sin * vx - cos * vz;
  moveCircle(p, wx * speed * dt, wz * speed * dt);
  return true;
}
const idle = () => ({ moveX: 0, moveZ: 0, action: false, dash: false, crouch: false });

// state を dt 秒進める。inputs: {hunter:{...}, intruder:{...}}
export function step(st, inputs, dt) {
  if (st.phase !== 'play') return st;
  const hi = inputs.hunter || idle(), ii = inputs.intruder || idle();
  st.t += dt; st.timeLeft = CFG.matchTime - st.t;
  const hu = st.hunter, it = st.intruder;
  hu.yaw = hi.yaw ?? hu.yaw; it.yaw = ii.yaw ?? it.yaw;
  if (ii.crouchToggle) it.crouch = !it.crouch;
  // ダッシュ管理
  it.dashCd = Math.max(0, it.dashCd - dt);
  if (ii.dash && it.dashCd <= 0 && it.dashT <= 0) { it.dashT = CFG.dashTime; it.dashCd = CFG.dashCooldown; }
  const dashing = it.dashT > 0; if (dashing) it.dashT -= dt;
  // 移動
  hu.stagger = Math.max(0, hu.stagger - dt);
  if (hu.stagger <= 0) applyMove(hu, hi, CFG.hunterSpeed, dt);
  const iSpeed = dashing ? CFG.dashSpeed : (it.crouch ? CFG.crouchSpeed : CFG.intruderSpeed);
  const moved = applyMove(it, ii, iSpeed, dt);
  if (dashing && moved) { const last = st.traces[st.traces.length - 1]; if (!last || Math.hypot(last.x - it.x, last.z - it.z) > 0.9) st.traces.push({ x: it.x, z: it.z, ttl: CFG.traceLife }); }
  st.traces = st.traces.filter(tr => (tr.ttl -= dt) > 0);
  // 視認
  const dHI = dist(hu, it);
  const seen = dHI < 16 && losClear(hu.x, hu.z, it.x, it.z) && angleDiff(aimYaw(hu, it), hu.yaw) < 1.55;
  if (seen) { it.unseen = 0; st.metrics.seenTime += dt; } else it.unseen += dt;
  // 装置操作
  let channeling = null;
  if (ii.action && !dashing) for (const d of st.devices) { if (!d.done && dist(it, d) < CFG.interactRange) { channeling = d; break; } }
  if (channeling) {
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
  const canCapture = st.t >= CFG.spawnProtect && hu.stagger <= 0 && dHI < CFG.captureRange && losClear(hu.x, hu.z, it.x, it.z) && angleDiff(aimYaw(hu, it), hu.yaw) < 1.5;
  if (hi.action && canCapture) {
    st.capture += dt;
    if (st.capture >= CFG.captureTime) { st.phase = 'hunter_win'; st.reason = 'capture'; st.metrics.captureAt = st.t; }
  } else {
    if (st.capture > 0 && hi.action) { hu.stagger = CFG.captureStagger; } // 外したら隙
    st.capture = 0;
  }
  if (st.phase === 'play' && st.timeLeft <= 0) { st.phase = 'hunter_win'; st.reason = 'timeout'; }
  return st;
}
export function aimYaw(from, to) { return Math.atan2(to.x - from.x, -(to.z - from.z)); }
export function angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); }
// 視線方向ベクトル (yaw=0 → -z)
export function facing(yaw) { return { x: Math.sin(yaw), z: -Math.cos(yaw) }; }

// ---- グリッドBFS (BOTと到達可能性テスト用) ----
export function bfsPath(sx, sz, tx, tz) {
  const s = { cx: Math.floor(sx / CELL), cz: Math.floor(sz / CELL) }, g = { cx: Math.floor(tx / CELL), cz: Math.floor(tz / CELL) };
  const key = (x, z) => x + ',' + z; const prev = new Map([[key(s.cx, s.cz), null]]); const q = [s];
  while (q.length) { const c = q.shift(); if (c.cx === g.cx && c.cz === g.cz) { const path = []; let k = key(c.cx, c.cz), cur = c; while (k) { path.unshift({ x: cur.cx * CELL + 1, z: cur.cz * CELL + 1 }); const p = prev.get(k); if (!p) break; cur = p; k = key(p.cx, p.cz); } return path; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = c.cx + dx, nz = c.cz + dz, k = key(nx, nz); if (prev.has(k) || cellAt(nx, nz) === '#') continue; prev.set(k, c); q.push({ cx: nx, cz: nz }); } }
  return null;
}
function inputToward(p, target, speedYaw = true) {
  const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.5) return { input: idle(), arrived: true };
  const wantYaw = Math.atan2(dx, -dz);
  // ローカル入力: 前進量と横移動量をyaw基準で
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const fwd = { x: sin, z: -cos }, right = { x: cos, z: sin };
  const ux = dx / d, uz = dz / d;
  return { input: { moveX: ux * right.x + uz * right.z, moveZ: ux * fwd.x + uz * fwd.z, yaw: wantYaw, action: false, dash: false }, arrived: false };
}
function followPath(p, path, lookTarget) {
  if (!path || path.length === 0) return idle();
  let wp = path[0]; if (Math.hypot(wp.x - p.x, wp.z - p.z) < 0.7 && path.length > 1) path.shift(), wp = path[0];
  const r = inputToward(p, wp); if (lookTarget) r.input.yaw = Math.atan2(lookTarget.x - p.x, -(lookTarget.z - p.z)); return r.input;
}

// ---- BOT ----
export function botIntruder(st, mem) {
  const it = st.intruder, hu = st.hunter;
  mem.path = mem.path || null; mem.retarget = mem.retarget || 0;
  const dH = dist(it, hu), seesMe = dH < 13 && losClear(hu.x, hu.z, it.x, it.z) && angleDiff(Math.atan2(it.x - hu.x, -(it.z - hu.z)), hu.yaw) < 1.25;
  // ゲート開放後、ゲート目前なら捕獲圏にいない限り突っ込む
  if (st.gatesOpen) { const g = GATES.slice().sort((a, b) => dist(it, a) - dist(it, b))[0]; if (dist(it, g) < CFG.interactRange - 0.2) { const a = idle(); a.action = true; a.yaw = Math.atan2(g.x - it.x, -(g.z - it.z)); return a; } if (dist(it, g) < 7 && dH > 2.8) { return followPath(it, (bfsPath(it.x, it.z, g.x, g.z) || []).slice(1), g); } }
  // 逃走: ハンターが近く視線がある、または接近気配の範囲内（実ゲームの近接UI相当）
  if ((seesMe && dH < 9) || dH < 5) {
    mem.fleeT = (mem.fleeT || 0) - 1;
    if (!mem.fleeTarget || mem.fleeT <= 0) {
      let best = null, bestScore = -1e9;
      for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2, tx = it.x + Math.sin(ang) * 6, tz = it.z - Math.cos(ang) * 6; if (isWall(tx, tz)) continue; const hp = bfsPath(hu.x, hu.z, tx, tz); if (!hp) continue; const score = hp.length * 2 + (losClear(tx, tz, hu.x, hu.z) ? 0 : 5) - Math.hypot(tx - it.x, tz - it.z) * 0.3; if (score > bestScore) { bestScore = score; best = { x: tx, z: tz }; } }
      mem.fleeTarget = best; mem.fleeT = 6; mem.path = best ? bfsPath(it.x, it.z, best.x, best.z) : null;
    }
    if (mem.fleeTarget) { const inp = followPath(it, mem.path && mem.path.slice(), hu); inp.dash = dH < 4.5; inp.yaw = Math.atan2(it.x - hu.x, -(it.z - hu.z)) + Math.PI; return inp; }
  } else mem.fleeTarget = null;
  // 目標: ゲート or 未完了装置で近いもの（ハンターが近い装置は避ける）
  let target = null;
  if (st.gatesOpen) { target = GATES.map(g => ({ ...g, kind: 'gate' })).sort((a, b) => dist(it, a) - dist(it, b))[0]; }
  else {
    if (!mem.jitter) { const r = mem.rng || Math.random; mem.jitter = st.devices.map(() => r() * 14); }
    // 信号が漏れた装置は、進捗半分未満なら囮として捨てて別装置へ（読み合い）
    const leaked = st.devices.find(d => !d.done && d.pinged && d.progress < CFG.deviceTime * 0.5 && st.hunterKnow.deviceId === d.id && st.t - st.hunterKnow.at < 12);
    const pool = st.devices.filter(d => !d.done && (!leaked || d.id !== leaked.id));
    const cands = pool.sort((a, b) => (dist(it, a) - dist(hu, a) * 1.0 + mem.jitter[a.id]) - (dist(it, b) - dist(hu, b) * 1.0 + mem.jitter[b.id]));
    target = cands[0] && { ...cands[0], kind: 'device' };
  }
  if (!target) return idle();
  const dT = dist(it, target);
  if (dT < CFG.interactRange - 0.3) { const inp = idle(); inp.action = true; inp.yaw = Math.atan2(target.x - it.x, -(target.z - it.z)); return inp; }
  // 警戒: 目標が遠くハンターが中距離にいて視線が通るなら、物陰で待つ（後半は待たない）
  if (target.kind === 'device' && st.t < 130 && dH < 10 && dH > 5 && losClear(it.x, it.z, hu.x, hu.z)) { const inp = idle(); inp.crouchToggle = it.crouch ? false : true; inp.yaw = Math.atan2(hu.x - it.x, -(hu.z - it.z)); return inp; }
  mem.retarget -= 1;
  if (!mem.path || mem.retarget <= 0) { mem.path = bfsPath(it.x, it.z, target.x, target.z); mem.retarget = 30; }
  const path = mem.path ? mem.path.slice(1) : null;
  const inp = followPath(it, path, target); if (it.crouch) inp.crouchToggle = true; return inp;
}
export function botHunter(st, mem) {
  const hu = st.hunter, it = st.intruder;
  mem.path = mem.path || null; mem.retarget = mem.retarget || 0; mem.patrol = mem.patrol || 0; mem.searchT = mem.searchT || 0;
  const dI = dist(hu, it);
  const sees = dI < 16 && losClear(hu.x, hu.z, it.x, it.z) && angleDiff(Math.atan2(it.x - hu.x, -(it.z - hu.z)), hu.yaw) < 1.25;
  if (sees) mem.lkp = { x: it.x, z: it.z, at: st.t };
  let target = null, capture = false;
  if (sees || (mem.lkp && st.t - mem.lkp.at < 6 && dI < 10)) { target = sees ? { x: it.x, z: it.z } : mem.lkp; if (sees && dI < CFG.captureRange) capture = true; }
  else if (st.gatesOpen) { mem.gatePatrol = mem.gatePatrol || 0; mem.gateT = (mem.gateT || 0) + 1; if (mem.gateT > 120) { mem.gatePatrol++; mem.gateT = 0; } target = { ...GATES[mem.gatePatrol % GATES.length] }; if (dist(hu, target) < 2.2 && mem.gateT < 100) mem.gateT = 100; }
  else if (st.hunterKnow.deviceId >= 0 && st.t - st.hunterKnow.at < 25) { if (mem.knowAt !== st.hunterKnow.at) { mem.knowAt = st.hunterKnow.at; mem.reactUntil = st.t + 0.9; } if (st.t < mem.reactUntil) { const inp = idle(); inp.yaw = hu.yaw + 0.03; return inp; } const d = st.devices[st.hunterKnow.deviceId]; target = { x: d.x, z: d.z }; }
  else { const devs = st.devices; if (mem.patrolInit === undefined) { mem.patrolInit = 1; mem.patrol = Math.floor((mem.rng || Math.random)() * devs.length); } target = devs[mem.patrol % devs.length]; if (dist(hu, target) < 1.5) mem.patrol++; }
  if (!target) return idle();
  mem.retarget -= 1;
  if (!mem.path || mem.retarget <= 0) { mem.path = bfsPath(hu.x, hu.z, target.x, target.z); mem.retarget = 20; }
  const path = mem.path ? mem.path.slice(1) : null;
  const inp = followPath(hu, path, sees ? it : target);
  if (capture) { inp.action = true; inp.moveX = 0; inp.moveZ = 0; inp.yaw = Math.atan2(it.x - hu.x, -(it.z - hu.z)); }
  return inp;
}
