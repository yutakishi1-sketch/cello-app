/* チェロのアプリ用：claude.ai の保存の仕組み（claude.use("db") など）を、スマホの中の保存に置き換える。
   ページのコードは claude.ai 版と同じまま動く。書いた記録は、設定があれば Google スプレッドシートにも写す。 */
(() => {
  // ── 使う人の切り替え ──
  // 1台を何人かで使えるように、保存の名前（キー）の頭に人の印を付ける。最初の人（p1）は印なし（これまでの記録をそのまま使う）
  const S = Storage.prototype, rawGet = S.getItem, rawSet = S.setItem, rawDel = S.removeItem;
  const PKEY = "cello-app:profile", PLIST = "cello-app:profiles";
  let pid = "p1";
  try { pid = rawGet.call(localStorage, PKEY) || "p1"; } catch { /* 保存できない環境では1人で使う */ }
  if (pid !== "p1") {
    // 印を付けるのは localStorage だけ（sessionStorage はそのまま）
    const keyOf = (store, k) => (store !== localStorage || k === PKEY || k === PLIST) ? k : pid + "|" + k;
    S.getItem = function (k) { return rawGet.call(this, keyOf(this, String(k))); };
    S.setItem = function (k, v) { return rawSet.call(this, keyOf(this, String(k)), v); };
    S.removeItem = function (k) { return rawDel.call(this, keyOf(this, String(k))); };
  }
  const readRaw = (k, d) => { try { const v = JSON.parse(rawGet.call(localStorage, k)); return v ?? d; } catch { return d; } };
  window.celloProfiles = {
    current: () => pid,
    list: () => { const l = readRaw(PLIST, null); return Array.isArray(l) && l.length ? l : [{ id: "p1", name: "わたし" }]; },
    save(list) { try { rawSet.call(localStorage, PLIST, JSON.stringify(list)); } catch (e) { console.warn("使う人の一覧を保存できませんでした", e); } },
    switchTo(id) { try { rawSet.call(localStorage, PKEY, id); } catch (e) { console.warn("使う人を切り替えられませんでした", e); } },
  };

  const KEY = "cello-app:db", QKEY = "cello-app:sync-queue", URLKEY = "cello-app:sync-url";
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const clone = v => JSON.parse(JSON.stringify(v));

  let store = read(KEY, null);
  if (!store) { store = {}; write(KEY, store); }
  const subs = new Set();   // { kind: "doc"|"col", path, cb }

  function docSnap(path) {
    const has = Object.prototype.hasOwnProperty.call(store, path);
    const data = has ? clone(store[path]) : undefined;
    return { id: path.split("/").pop(), exists: has, data: () => data };
  }
  function colSnap(path) {
    const pre = path + "/", docs = Object.keys(store).filter(p => p.startsWith(pre) && !p.slice(pre.length).includes("/")).sort().map(docSnap);
    return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) };
  }
  function notify(path) {
    const parent = path.split("/").slice(0, -1).join("/");
    subs.forEach(s => { if ((s.kind === "doc" && s.path === path) || (s.kind === "col" && s.path === parent)) setTimeout(() => s.cb(s.kind === "doc" ? docSnap(s.path) : colSnap(s.path)), 0); });
  }
  function save(path, data) {
    if (data === undefined) delete store[path]; else store[path] = clone(data);
    if (!write(KEY, store)) throw Object.assign(new Error("スマホの保存領域がいっぱいです"), { code: "storage_full" });
    notify(path); queue(path, data);
  }

  // スプレッドシートへ写す（届かなかった分は次に回す）
  function queue(path, data) {
    if (pid !== "p1") path = pid + "/" + path;
    const q = read(QKEY, []); q.push({ path, data: data === undefined ? null : data, deleted: data === undefined, at: new Date().toISOString() });
    write(QKEY, q.slice(-500)); flush();
  }
  let flushing = false;
  async function flush() {
    const url = read(URLKEY, ""); if (!url || flushing || !navigator.onLine) return;
    const q = read(QKEY, []); if (!q.length) return;
    flushing = true;
    try {
      await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ app: "cello", items: q }) });
      const rest = read(QKEY, []).slice(q.length); write(QKEY, rest);
      write("cello-app:last-sync", new Date().toISOString());
    } catch (e) { console.warn("スプレッドシートに送れませんでした。あとで送り直します", e); }
    finally { flushing = false; }
  }
  addEventListener("online", flush);
  window.celloSync = {
    url: () => read(URLKEY, ""), setUrl: u => { write(URLKEY, u.trim()); flush(); },
    pending: () => read(QKEY, []).length, last: () => read("cello-app:last-sync", ""),
    // 外枠と各ページは別々に読み込むので、送り直しは保存領域の最新から作る
    sendAll: () => { const cur = read(KEY, {}), at = new Date().toISOString(); write(QKEY, [...read(QKEY, []), ...Object.keys(cur).map(p => ({ path: pid === "p1" ? p : pid + "/" + p, data: cur[p], deleted: false, at }))]); return flush(); },
    flush,
  };

  function docRef(path) {
    return {
      id: path.split("/").pop(), path,
      async get() { return docSnap(path); },
      async set(data) { save(path, data); },
      async update(patch) { save(path, { ...(store[path] || {}), ...patch }); },
      async delete() { save(path, undefined); },
      onSnapshot(cb, err) { const s = { kind: "doc", path, cb }; subs.add(s); setTimeout(() => cb(docSnap(path)), 0); return () => subs.delete(s); },
    };
  }
  function colRef(path) {
    return {
      path,
      doc: id => docRef(path + "/" + (id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7))),
      async add(data) { const r = this.doc(); save(r.path, data); return r; },
      async get() { return colSnap(path); },
      onSnapshot(cb, err) { const s = { kind: "col", path, cb }; subs.add(s); setTimeout(() => cb(colSnap(path)), 0); return () => subs.delete(s); },
    };
  }
  const db = { doc: docRef, collection: colRef };
  const user = { isOwner: () => true, canEdit: () => true, can: async () => true, id: async () => "me", me: async () => ({ id: "me", name: "" }) };

  // 初めて開いたときだけ、claude.ai から書き出した記録を入れる
  window.celloSeed = seed => { if (Object.keys(store).length) return; Object.entries(seed || {}).forEach(([p, v]) => { store[p] = v; }); write(KEY, store); };

  window.claude = { use: async name => name === "db" ? db : name === "user" ? user : null };

  // 他のページへのリンク（claude.ai の各ページ）を、アプリの中の切り替えにする
  const ROUTES = { "4jkVwChzQKFfxCUR8QBD3A": "road", "JuFha8i4nhqDb6eZZaygpj": "score", "JKa7TVRz2XjCEPKV3qoyKX": "finger", "JV8U4MGWMWX6g7grb5Dd8r": "finger", "HnwDJT7kZBXT8n8uDEeomZ": "metro", "JLKfEUDVVCBNLj22oGrLqt": "tuner" };
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
    const m = a.href.match(/claude\.ai\/(?:code\/)?artifact\/([A-Za-z0-9]+)(#.*)?$/); if (!m || !ROUTES[m[1]]) return;
    e.preventDefault();
    const go = ROUTES[m[1]] + (m[2] ? ":" + m[2].slice(1) : "");
    if (window.top !== window) window.top.postMessage({ celloGo: go }, location.origin); else location.href = "../index.html#" + go;
  }, true);
})();
