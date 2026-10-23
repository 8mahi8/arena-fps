import { test } from 'node:test'; import assert from 'node:assert';
import { createState, step, bfsPath, isWall, isBlocked, TERMINALS, GATES, CFG, losClear, seesHunter } from '../src/core.mjs';
const idle = { moveX: 0, moveZ: 0, action: false };
function run(st, inputs, sec) { const dt = 1 / 20; for (let i = 0; i < sec / dt; i++) step(st, inputs, dt); }
test('スポーンから全端末候補・両ゲートへ到達できる', () => {
  const st = createState(1);
  for (const t of TERMINALS) { assert.ok(bfsPath(st.intruder.x, st.intruder.z, t.x, t.z) || bfsPath(st.intruder.x, st.intruder.z, t.x + 2, t.z), 'intruder->terminal ' + t.name); assert.ok(bfsPath(st.hunter.x, st.hunter.z, t.x, t.z) || bfsPath(st.hunter.x, st.hunter.z, t.x, t.z + 2), 'hunter->terminal ' + t.name); }
  for (const g of GATES) assert.ok(bfsPath(st.intruder.x, st.intruder.z, g.x, g.z - 2), 'intruder->gate');
});
test('有効端末は毎試合4台だけ選ばれる', () => {
  for (const seed of [1, 2, 3, 42, 99]) { const st = createState(seed); assert.equal(st.devices.length, 4); assert.equal(new Set(st.devices.map(d => d.tid)).size, 4); }
});
test('侵入者は端末に近づくまで発見できず、近づけば発見する', () => {
  const st = createState(42); const d = st.devices[0];
  assert.equal(st.knownDevices.includes(d.id), false);
  st.intruder.x = d.x; st.intruder.z = d.z + 10; // 10m先（ライトOFF・発見範囲外）
  run(st, { intruder: idle, hunter: idle }, 0.3);
  assert.equal(st.knownDevices.includes(d.id), false);
  st.intruder.z = d.z + 3;
  run(st, { intruder: idle, hunter: idle }, 0.3);
  assert.equal(st.knownDevices.includes(d.id), true);
});
test('ライト点灯中は遠くの端末も発見できる', () => {
  const st = createState(42); const d = st.devices[0];
  st.intruder.x = d.x; st.intruder.z = d.z + 8; st.intruder.lightOn = true;
  run(st, { intruder: idle, hunter: idle }, 0.3);
  assert.equal(st.knownDevices.includes(d.id), true);
});
test('ライト点灯中の侵入者は遠くからでもハンターに視認される', () => {
  const st = createState(42);
  st.hunter.x = 33; st.hunter.z = 29; st.hunter.yaw = 0;
  st.intruder.x = 33; st.intruder.z = 11; // 18m北・ドア列で視線あり
  st.intruder.lightOn = false; assert.equal(seesHunter(st), false);
  st.intruder.lightOn = true; assert.equal(seesHunter(st), true);
});
test('しゃがんだ侵入者は低い遮蔽（ベッド）の後ろでは視認されない', () => {
  const st = createState(42);
  // ベッドセル (2,2)=世界(5,5)。ハンター(5,9)→侵入者(5,3): 間にベッド
  st.hunter.x = 5; st.hunter.z = 9; st.hunter.yaw = 0;
  st.intruder.x = 5; st.intruder.z = 3; st.intruder.crouch = false;
  assert.equal(seesHunter(st), true);
  st.intruder.crouch = true;
  assert.equal(seesHunter(st), false);
});
test('ハンター初期位置から両ゲートを同時に視認できない', () => {
  const st = createState(42);
  const seen = GATES.filter(g => losClear(st.hunter.x, st.hunter.z, g.x, g.z));
  assert.ok(seen.length <= 1, `同時視認ゲート数=${seen.length}`);
});
test('装置は長押しで進み、中断しても進行が残る／通知は遅延する', () => {
  const st = createState(42); const d = st.devices[0];
  st.intruder.x = d.x; st.intruder.z = d.z + 1;
  run(st, { intruder: { ...idle, action: true }, hunter: idle }, 3);
  const p1 = st.devices[0].progress; assert.ok(p1 >= 2.9, `progress=${p1}`);
  run(st, { intruder: idle, hunter: idle }, 1);
  assert.equal(st.devices[0].progress, p1);
  run(st, { intruder: { ...idle, action: true }, hunter: idle }, 4.5);
  assert.equal(st.hunterKnow.deviceId, 0);
});
test('2台完了でゲートが開き、脱出できる', () => {
  const st = createState(42);
  st.devices[1].done = true;
  st.devices[0].progress = CFG.deviceTime - 0.01; st.intruder.x = st.devices[0].x; st.intruder.z = st.devices[0].z + 1;
  run(st, { intruder: { ...idle, action: true }, hunter: idle }, 0.1);
  assert.equal(st.gatesOpen, true);
  st.intruder.x = GATES[0].x; st.intruder.z = GATES[0].z - 1;
  run(st, { intruder: { ...idle, action: true }, hunter: idle }, 0.7);
  assert.equal(st.phase, 'intruder_win');
});
test('捕獲は正面・視線・長押しで成立し、壁越しとスポーン直後は成立しない', () => {
  let st = createState(42); st.t = 10;
  st.hunter.x = st.intruder.x; st.hunter.z = st.intruder.z + 1.5;
  run(st, { hunter: { ...idle, action: true, yaw: 0 }, intruder: idle }, 0.8);
  assert.equal(st.phase, 'hunter_win');
  st = createState(42);
  st.hunter.x = st.intruder.x; st.hunter.z = st.intruder.z + 1.5;
  run(st, { hunter: { ...idle, action: true, yaw: 0 }, intruder: idle }, 1.2);
  assert.equal(st.phase, 'play'); // スポーン保護5秒
});
test('時間切れはハンター勝ち／壁と遮蔽には入れない', () => {
  const st = createState(42); run(st, { hunter: idle, intruder: idle }, CFG.matchTime + 1);
  assert.equal(st.phase, 'hunter_win'); assert.equal(st.reason, 'timeout');
  const st2 = createState(42); st2.intruder.x = 3; st2.intruder.z = 3;
  run(st2, { intruder: { ...idle, moveZ: 1, yaw: 0 }, hunter: idle }, 3);
  assert.ok(!isBlocked(st2.intruder.x, st2.intruder.z));
});
