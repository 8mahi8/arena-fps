import { test } from 'node:test'; import assert from 'node:assert';
import { createState, step, bfsPath, isWall, DEVICES, GATES, CFG, losClear } from '../src/core.mjs';
const idle = { moveX: 0, moveZ: 0, action: false };
function run(st, inputs, sec) { const dt = 1 / 20; for (let i = 0; i < sec / dt; i++) step(st, inputs, dt); }
test('スポーンから全装置・両ゲートへ到達できる', () => {
  const st = createState();
  for (const d of DEVICES) { assert.ok(bfsPath(st.intruder.x, st.intruder.z, d.x, d.z), 'intruder->device'); assert.ok(bfsPath(st.hunter.x, st.hunter.z, d.x, d.z), 'hunter->device'); }
  for (const g of GATES) { assert.ok(bfsPath(st.intruder.x, st.intruder.z, g.x, g.z), 'intruder->gate'); assert.ok(bfsPath(st.hunter.x, st.hunter.z, g.x, g.z), 'hunter->gate'); }
});
test('ハンター初期位置から両ゲートを同時に視認できない', () => {
  const st = createState();
  const seen = GATES.filter(g => losClear(st.hunter.x, st.hunter.z, g.x, g.z));
  assert.ok(seen.length <= 1, `同時視認ゲート数=${seen.length}`);
});
test('装置は長押しで進み、中断しても進行が残る', () => {
  const st = createState(); const d = st.devices[0];
  st.intruder.x = d.x; st.intruder.z = d.z + 1;
  run(st, { intruder: { ...idle, action: true }, hunter: idle }, 3);
  const p1 = st.devices[0].progress; assert.ok(p1 >= 2.9, `progress=${p1}`);
  run(st, { intruder: idle, hunter: idle }, 1);
  assert.equal(st.devices[0].progress, p1);
});
test('操作累計3秒で4秒後にハンターへ通知される', () => {
  const st = createState(); const d = st.devices[0];
  st.intruder.x = d.x; st.intruder.z = d.z + 1;
  run(st, { intruder: { ...idle, action: true }, hunter: idle }, 3.1);
  assert.equal(st.hunterKnow.deviceId, -1);
  run(st, { intruder: { ...idle, action: true }, hunter: idle }, 4.2);
  assert.equal(st.hunterKnow.deviceId, 0);
});
test('2台完了前はゲートが開かず、完了で開く', () => {
  const st = createState();
  st.devices[1].done = true; // 1台は完了済み
  st.devices[0].progress = CFG.deviceTime - 0.01; st.intruder.x = st.devices[0].x; st.intruder.z = st.devices[0].z + 1;
  assert.equal(st.gatesOpen, false);
  run(st, { intruder: { ...idle, action: true }, hunter: idle }, 0.1);
  assert.equal(st.gatesOpen, true); assert.equal(st.phase, 'play');
});
test('捕獲は範囲内+視線+長押し0.6秒で成立し、壁越しは成立しない', () => {
  let st = createState(); st.t = 10;
  st.hunter.x = st.intruder.x; st.hunter.z = st.intruder.z + 1.5; st.hunter.yaw = 0; // 北（侵入者側）を向く
  run(st, { hunter: { ...idle, action: true, yaw: 0 }, intruder: idle }, 0.8);
  assert.equal(st.phase, 'hunter_win');
  st = createState(); st.t = 10;
  // 壁列(x=12〜14)を挟んだ配置。捕獲範囲を一時的に広げても壁越しには成立しないこと
  const savedRange = CFG.captureRange; CFG.captureRange = 5;
  st.hunter.x = 11; st.hunter.z = 11; st.intruder.x = 15; st.intruder.z = 11; st.hunter.yaw = Math.PI / 2;
  run(st, { hunter: { ...idle, action: true, yaw: Math.PI / 2 }, intruder: idle }, 1);
  CFG.captureRange = savedRange;
  assert.notEqual(st.phase, 'hunter_win');
});
test('開始5秒はスポーン保護で捕獲できない', () => {
  const st = createState();
  st.hunter.x = st.intruder.x; st.hunter.z = st.intruder.z + 1.5;
  run(st, { hunter: { ...idle, action: true, yaw: 0 }, intruder: idle }, 1.2);
  assert.equal(st.phase, 'play');
});
test('時間切れはハンター勝ち', () => {
  const st = createState(); run(st, { hunter: idle, intruder: idle }, 181);
  assert.equal(st.phase, 'hunter_win'); assert.equal(st.reason, 'timeout');
});
test('壁の中へは移動できない', () => {
  const st = createState(); st.intruder.x = 3; st.intruder.z = 3;
  run(st, { intruder: { ...idle, moveZ: 1, yaw: 0 }, hunter: idle }, 3);
  assert.ok(!isWall(st.intruder.x, st.intruder.z));
});
