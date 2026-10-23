import { test } from 'node:test'; import assert from 'node:assert';
// Firebase RTDB の使用サブセットを再現したインメモリ偽物で、net.js のルーム/同期フローを検証する。
// 実RTDB・実ブラウザ2画面の検証は別途（本テストはAPIレベルの整合性確認）。
class FakeRef {
  constructor(db, path) { this.db = db; this.path = path; }
  child(p) {
    // 実SDKと同じパス検証（".", "#", "$", "[", "]" を含むセグメントは例外）
    for (const seg of String(p).split('/')) if (/[.#$\[\]]/.test(seg)) throw new Error(`child failed: path argument was an invalid path = "${p}"`);
    return new FakeRef(this.db, this.path ? this.path + '/' + p : p);
  }
  get val() { return this.path.split('/').filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), this.db.store); }
  set(v) { return this.db.write(this.path, v, 'set'); }
  update(v) { return this.db.write(this.path, v, 'update'); }
  once() { const v = this.val; return Promise.resolve({ val: () => (v === undefined ? null : structuredClone(v)), exists: () => v !== undefined && v !== null }); }
  on(ev, cb) { this.db.listeners.push({ path: this.path, cb }); if (this.path === '.info/connected') { queueMicrotask(() => cb({ val: () => true })); return; } const v = this.val; queueMicrotask(() => cb({ val: () => (v === undefined ? null : structuredClone(v)) })); }
  onDisconnect() { return { update: () => Promise.resolve() }; }
  async transaction(fn) {
    const cur = this.val === undefined ? null : structuredClone(this.val);
    const next = fn(cur);
    if (next === undefined) return { committed: false };
    await this.db.write(this.path, next, 'set');
    return { committed: true };
  }
}
class FakeDb {
  constructor() { this.store = {}; this.listeners = []; }
  ref(path) { return new FakeRef(this, path || ''); }
  async write(path, v, mode) {
    const keys = path.split('/').filter(Boolean); let o = this.store;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    const last = keys[keys.length - 1];
    if (mode === 'set') o[last] = v === null ? undefined : structuredClone(v);
    else o[last] = { ...(o[last] || {}), ...structuredClone(v) };
    for (const l of this.listeners) {
      if (l.path === path || path.startsWith(l.path + '/') || l.path.startsWith(path + '/')) {
        const ref = new FakeRef(this, l.path); const val = ref.val;
        queueMicrotask(() => l.cb({ val: () => (val === undefined ? null : structuredClone(val)) }));
      }
    }
  }
}
const fakeDb = new FakeDb();
const fakeFirebase = {
  apps: [], database: Object.assign(() => fakeDb, { ServerValue: { TIMESTAMP: 123 } }),
  initializeApp() { fakeFirebase.apps.push(1); },
};
globalThis.window = { firebase: fakeFirebase };
const { createNet } = await import('../src/net.js');
const tick = () => new Promise(r => setTimeout(r, 10));

test('部屋作成→参加→開始→状態同期→入力同期が通る', async () => {
  const hostSnaps = [], guestSnaps = [], hostInputs = [];
  const host = createNet({ onStatus() {}, onPresence() {}, onRoomReady() {}, onGuestInput: v => hostInputs.push(v), onSnapshot: v => hostSnaps.push(v) });
  const code = await host.createRoom('hunter');
  assert.match(code, /^\d{5}$/);
  const guest = createNet({ onStatus() {}, onPresence() {}, onRoomReady() {}, onGuestInput() {}, onSnapshot: v => guestSnaps.push(v) });
  await guest.joinRoom(code);
  assert.equal(guest.role, 'intruder'); assert.equal(host.role, 'hunter');
  host.startMatch();
  host.publishState({ seq: 1, phase: 'play', t: 0.5 });
  await tick();
  assert.equal(guestSnaps.length, 1); assert.equal(guestSnaps[0].phase, 'play');
  guest.sendInput({ moveX: 0, moveZ: 1, yaw: 1.2, action: false, dash: false });
  await tick();
  assert.ok(hostInputs.length >= 1); assert.equal(hostInputs[hostInputs.length - 1].moveZ, 1);
  host.publishResult({ seq: 2, phase: 'hunter_win', reason: 'capture' });
  await tick();
  assert.equal(guestSnaps[guestSnaps.length - 1].phase, 'hunter_win');
});
test('満員の部屋には参加できない', async () => {
  const host = createNet({ onStatus() {}, onPresence() {}, onRoomReady() {}, onGuestInput() {}, onSnapshot() {} });
  const code = await host.createRoom('intruder');
  const g1 = createNet({ onStatus() {}, onPresence() {}, onRoomReady() {}, onGuestInput() {}, onSnapshot() {} });
  await g1.joinRoom(code); assert.equal(g1.role, 'hunter');
  let status = '';
  const g2 = createNet({ onStatus: s => status = s, onPresence() {}, onRoomReady() {}, onGuestInput() {}, onSnapshot() {} });
  await g2.joinRoom(code);
  assert.match(status, /満員/);
});
