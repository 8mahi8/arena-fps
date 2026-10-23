// オンライン対戦（Firebase RTDB・部屋番号・ホスト権威）。小国戦線IIIの方式を小型化。
// ルーム: /stealthRooms1v1/{5桁} { meta, players:{host,guest}, state, guestInput }
// 認証なし・個人情報は書かない。ルール未設定の場合は PERMISSION_DENIED をそのまま表示する。
const DB_URL = 'https://mygame-df915-default-rtdb.firebaseio.com/';
const ROOT = 'stealthRooms1v1';
const VERSION = 1;
const token = () => { const a = new Uint32Array(2); crypto.getRandomValues(a); return Array.from(a, x => x.toString(36)).join('-'); };

export function createNet(callbacks) {
  const net = {
    clientId: token(), isHost: false, code: '', role: null, peerRole: null,
    roomRef: null, lastStateSeq: -1, lastEventSeq: 0, connected: false, peerOnline: false,
    inputSeq: 0, lastInputSentAt: 0, lastInputJson: '',
  };
  let db = null;
  function ensureDb() {
    if (db) return db;
    if (!window.firebase?.database) throw new Error('Firebase SDKが読み込まれていません（ネット接続を確認）');
    if (!window.firebase.apps?.length) window.firebase.initializeApp({ databaseURL: DB_URL });
    db = window.firebase.database();
    return db;
  }
  const err = e => callbacks.onStatus('通信エラー: ' + (e?.code === 'PERMISSION_DENIED' ? 'Firebaseのルールに stealthRooms1v1 が必要です' : (e?.message || String(e))));
  net.createRoom = async (myRole) => {
    try {
      const d = ensureDb(); net.isHost = true; net.role = myRole; net.peerRole = myRole === 'hunter' ? 'intruder' : 'hunter';
      for (let i = 0; i < 12; i++) {
        const code = String(10000 + Math.floor(Math.random() * 90000));
        const ref = d.ref(`${ROOT}/${code}`);
        const snap = await ref.child('meta').once('value');
        if (snap.exists()) continue;
        await ref.set({
          meta: { v: VERSION, status: 'lobby', hostRole: myRole, created: window.firebase.database.ServerValue.TIMESTAMP },
          players: { host: { id: net.clientId, online: true }, guest: { id: '', online: false } },
          state: null, guestInput: null,
        });
        net.code = code; net.roomRef = ref; attach(); callbacks.onStatus(`部屋 ${code} を作成。友達に番号を伝えてください`);
        callbacks.onRoomReady(code, true);
        return code;
      }
      callbacks.onStatus('部屋を作成できませんでした。もう一度お試しください');
    } catch (e) { err(e); }
  };
  net.joinRoom = async (code) => {
    try {
      const d = ensureDb(); net.isHost = false;
      const ref = d.ref(`${ROOT}/${code}`);
      const meta = (await ref.child('meta').once('value')).val();
      if (!meta) { callbacks.onStatus('その番号の部屋が見つかりません'); return; }
      if (meta.v !== VERSION) { callbacks.onStatus('バージョンが違う部屋です'); return; }
      const guestRef = ref.child('players/guest');
      const res = await guestRef.transaction(cur => {
        if (cur && cur.id && cur.online && cur.id !== net.clientId) return; // 満席は中断
        return { id: net.clientId, online: true };
      });
      if (!res.committed) { callbacks.onStatus('その部屋は満員です'); return; }
      net.code = code; net.roomRef = ref; net.peerRole = meta.hostRole; net.role = meta.hostRole === 'hunter' ? 'intruder' : 'hunter';
      attach(); callbacks.onStatus(`部屋 ${code} に参加。あなたは${net.role === 'hunter' ? 'ハンター' : '侵入者'}`);
      callbacks.onRoomReady(code, false);
    } catch (e) { err(e); }
  };
  function attach() {
    const ref = net.roomRef, seat = net.isHost ? 'host' : 'guest', other = net.isHost ? 'guest' : 'host';
    const myPresence = ref.child(`players/${seat}`);
    db.ref('.info/connected').on('value', s => {
      net.connected = !!s.val();
      if (net.connected) { myPresence.update({ id: net.clientId, online: true }); myPresence.onDisconnect().update({ online: false }); }
      callbacks.onPresence(net.connected, net.peerOnline);
    });
    ref.child(`players/${other}`).on('value', s => { const v = s.val(); net.peerOnline = !!(v && v.online); callbacks.onPresence(net.connected, net.peerOnline); });
    ref.child('meta/status').on('value', s => callbacks.onStatus2?.(s.val()));
    if (net.isHost) {
      ref.child('guestInput').on('value', s => { const v = s.val(); if (v) callbacks.onGuestInput(v); });
    } else {
      ref.child('state').on('value', s => {
        const v = s.val(); if (!v || v.seq <= net.lastStateSeq) return;
        net.lastStateSeq = v.seq;
        callbacks.onSnapshot(v);
      });
    }
  }
  net.startMatch = () => { net.roomRef?.child('meta/status').set('playing').catch(err); };
  net.publishState = (snap) => { net.roomRef?.child('state').set(snap).catch(() => {}); };
  net.sendInput = (inp) => {
    const now = performance.now();
    const urgent = inp.crouchToggle || inp.lightToggle; // トグルは取りこぼし厳禁
    const j = JSON.stringify([inp.moveX, inp.moveZ, inp.yaw, inp.action, inp.dash]);
    if (!urgent && j === net.lastInputJson && now - net.lastInputSentAt < 400) return;
    if (!urgent && now - net.lastInputSentAt < 70) return;
    net.lastInputJson = j; net.lastInputSentAt = now;
    net.roomRef?.child('guestInput').set({ ...inp, seq: ++net.inputSeq }).catch(() => {});
  };
  net.publishResult = (snap) => { net.roomRef?.child('state').set(snap).catch(() => {}); net.roomRef?.child('meta/status').set('finished').catch(() => {}); };
  return net;
}
