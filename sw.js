// オフラインでも開けるように、アプリのファイルを取っておく。
// ページと部品（HTML・JS）は、つながっていれば毎回新しいものを取りに行き、つながらないときだけ取っておいたものを使う。
// 絵と文字は変わらないので、取っておいたものを先に使う。版が変わったら古い取り置きを捨てる
const VERSION = "16c5eceee207", FILES = ["./", "finger/art/board.jpg", "finger/art/book.png", "finger/art/cello-samples.js", "finger/art/corner.png", "finger/art/divider.png", "finger/art/lyre.png", "finger/art/medal.png", "finger/art/note.png", "finger/art/ring.png", "finger/art/speaker.png", "finger/art/stud.png", "finger/index.html", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "index.html", "manifest.webmanifest", "metro/art/metro-samples.js", "metro/art/orloj-dial.js", "metro/index.html", "road/art/castle-1920.jpg", "road/art/cello-samples.js", "road/art/cello-voice.js", "road/art/crest-1.png", "road/art/crest-2.png", "road/art/crest-3.png", "road/art/ui/bell.png", "road/art/ui/bow.png", "road/art/ui/cat-base.png", "road/art/ui/cat-book.png", "road/art/ui/cat-piece.png", "road/art/ui/cat-read.png", "road/art/ui/corner.png", "road/art/ui/divider.png", "road/art/ui/gate.png", "road/art/ui/hourglass.png", "road/art/ui/lantern.png", "road/art/ui/map-boss.png", "road/art/ui/map-clear.png", "road/art/ui/map-goal.png", "road/art/ui/map-here.png", "road/art/ui/map-todo.png", "road/art/ui/mk-boss.png", "road/art/ui/mk-clear.png", "road/art/ui/mk-now.png", "road/art/ui/mk-todo.png", "road/art/ui/pin-halo.png", "road/art/ui/pin-tri.png", "road/art/ui/pin.png", "road/art/ui/plaque.png", "road/art/ui/score.png", "road/art/ui/seal.png", "road/art/ui/stamp-bronze.png", "road/art/ui/stamp-gold.png", "road/art/ui/stamp-rest.png", "road/art/ui/stamp-silver.png", "road/index.html", "score/art/cello-samples.js", "score/art/cello-voice.js", "score/art/corner.png", "score/art/divider.png", "score/art/metro-samples.js", "score/art/metro-tick.js", "score/index.html", "shim.js", "tuner/art/cello-samples.js", "tuner/art/cello-voice.js", "tuner/index.html"], NAME = "cello-" + VERSION;
self.addEventListener("install", e => { e.waitUntil(caches.open(NAME).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("cello-") && k !== NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function put(req, res) { if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(NAME).then(c => c.put(req, copy)); } return res; }
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const shared = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/.test(url.hostname);
  if (url.origin !== location.origin && !shared) return;
  const fresh = url.origin === location.origin && (req.mode === "navigate" || /(\.html|\.js|\.webmanifest|\/)$/.test(url.pathname));
  if (fresh) {
    // ページを開く要求（navigate）には設定を足せないので、URL から作り直して最新を取りに行く
    e.respondWith(fetch(url.href, { cache: "no-store", credentials: "same-origin" }).then(res => put(req, res)).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: url.origin === location.origin }).then(hit => hit || fetch(req).then(res => put(req, res))));
});
