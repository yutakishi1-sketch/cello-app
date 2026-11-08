/* メトロノームの「カチッ」：楽譜帳の前奏（数え）と、弾いている間の拍を、メトロノームのページと同じ本物の録音で鳴らす共通の部品。
   録音は同じ場所の metro-samples.js（振り子（木）＝ Olga Ernst、Wikimedia Commons、CC BY-SA 4.0）。
   振り子は左右で少し音が違うので、2つを交互に鳴らす。読めないときは null を返す（呼んだ側で作った音にする） */
(() => {
  const BASE = document.currentScript ? new URL(".", document.currentScript.src).href : "art/";
  const bufs = [];
  let loading = null, swing = 0;

  function loadScript() {
    if (window.METRO_SAMPLES) return Promise.resolve(true);
    if (!loading) loading = new Promise(ok => {
      const s = document.createElement("script");
      s.src = BASE + "metro-samples.js";
      s.onload = () => ok(!!window.METRO_SAMPLES);
      s.onerror = () => { loading = null; console.warn("メトロノームの録音を読み込めませんでした"); ok(false); };
      document.head.append(s);
    });
    return loading;
  }

  // 使う前に1回呼ぶ（読み込めたら true）
  async function prepare(ctx) {
    if (bufs.length === 2) return true;
    if (!(await loadScript())) return false;
    try {
      for (const k of ["classic0", "classic1"]) {
        const url = window.METRO_SAMPLES[k], bin = atob(url.slice(url.indexOf(",") + 1)), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        bufs.push(await new Promise((ok, ng) => ctx.decodeAudioData(bytes.buffer, ok, ng)));
      }
      return true;
    } catch (e) { bufs.length = 0; console.warn("メトロノームの録音を開けませんでした", e); return false; }
  }

  // 1回鳴らす。strong＝小節の頭。vol で全体の大きさ（チェロの下で鳴らすときは小さく）
  function tick(ctx, t, { strong = false, vol = 1 } = {}) {
    if (bufs.length !== 2) return null;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = bufs[swing++ % 2]; g.gain.value = (strong ? 0.9 : 0.55) * vol;
    s.connect(g).connect(ctx.destination); s.start(t);
    return s;
  }

  window.MetroTick = { prepare, tick };
})();
