// BOT同士の対戦シミュレーション。node stealth/sim/simulate.mjs [試合数]
import { createState, step, botHunter, botIntruder } from '../src/core.mjs';
const N = Number(process.argv[2] || 30), dt = 1 / 20;
let hw = 0, iw = 0, timeouts = 0, caps = 0, esc = 0, times = [], devDone = 0, firstDev = [];
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
for (let m = 0; m < N; m++) {
  const st = createState(); const rng = mulberry32(1000 + m); const mh = { rng }, mi = { rng };
  let guard = 0;
  while (st.phase === 'play' && guard++ < 180 / dt + 10) step(st, { hunter: botHunter(st, mh), intruder: botIntruder(st, mi) }, dt);
  times.push(st.t); devDone += st.devices.filter(d => d.done).length;
  if (st.metrics.firstDeviceAt > 0) firstDev.push(st.metrics.firstDeviceAt);
  if (st.phase === 'hunter_win') { hw++; if (st.reason === 'timeout') timeouts++; else caps++; }
  else if (st.phase === 'intruder_win') { iw++; esc++; }
  else console.log('試合', m, '未決着 phase=', st.phase, 't=', st.t.toFixed(1));
}
const avg = a => a.length ? (a.reduce((s, v) => s + v, 0) / a.length).toFixed(1) : '-';
console.log(JSON.stringify({ matches: N, hunterWins: hw, intruderWins: iw, captures: caps, timeouts, escapes: esc, avgMatchSec: avg(times), avgDevicesDone: (devDone / N).toFixed(2), avgFirstDeviceSec: avg(firstDev) }, null, 1));
