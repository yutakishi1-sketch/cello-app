/* 弦の声：ヴァイオリン・ヴィオラを本物の録音で鳴らす共通の部品（合奏のほかのパート用）。チェロは cello-voice.js。
   録音は FluidR3 GM（Frank Wen 作、CC BY 3.0）を2半音おきに抜き出したもの（同じ場所の violin-samples.js・viola-samples.js、各約0.7MB）。
   間の音は近い録音を速く・遅く再生して出す。長い音は録音のまん中をなめらかにつないで繰り返して伸ばす。 */
(() => {
  const BASE = document.currentScript ? new URL(".", document.currentScript.src).href : "art/";
  const LOOP_A = 1.0, LOOP_B = 3.0, XF = 0.3;
  const cache = {}, loading = {};

  function loadScript(inst) {
    if (window.STRING_SAMPLES && window.STRING_SAMPLES[inst]) return Promise.resolve(true);
    if (!loading[inst]) loading[inst] = new Promise(ok => {
      const s = document.createElement("script");
      s.src = BASE + inst + "-samples.js";
      s.onload = () => ok(!!(window.STRING_SAMPLES && window.STRING_SAMPLES[inst]));
      s.onerror = () => { loading[inst] = null; console.warn(inst + " の録音を読み込めませんでした"); ok(false); };
      document.head.append(s);
    });
    return loading[inst];
  }
  const keys = inst => Object.keys(window.STRING_SAMPLES[inst]).map(Number);
  const near = (inst, m) => keys(inst).reduce((a, k) => Math.abs(k - m) < Math.abs(a - m) ? k : a);

  // つなぎ目の手前で、ループの始まりの直前の音へ少しずつ入れ替えておくと、繰り返しても「ぷつっ」と鳴らない
  function makeLoop(ctx, src) {
    const sr = src.sampleRate, b = Math.min(Math.floor(LOOP_B * sr), src.length - Math.floor(0.05 * sr)), a = Math.floor(LOOP_A * sr), x = Math.floor(XF * sr);
    if (b - a < 2 * x || a < x) return { buf: src, a: 0, b: src.duration };
    const out = ctx.createBuffer(src.numberOfChannels, src.length, sr);
    for (let c = 0; c < src.numberOfChannels; c++) {
      const d = src.getChannelData(c), o = out.getChannelData(c);
      o.set(d);
      for (let i = 0; i < x; i++) { const w = (i / x) * Math.PI / 2; o[b - x + i] = d[b - x + i] * Math.cos(w) + d[a - x + i] * Math.sin(w); }
    }
    return { buf: out, a: a / sr, b: b / sr };
  }
  async function decode(ctx, inst, m) {
    const id = inst + m;
    if (cache[id]) return cache[id];
    const url = window.STRING_SAMPLES[inst][m];
    if (!url) return null;
    const bin = atob(url.slice(url.indexOf(",") + 1)), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const buf = await new Promise((ok, ng) => ctx.decodeAudioData(bytes.buffer, ok, ng));
    cache[id] = makeLoop(ctx, buf);
    return cache[id];
  }
  // 使う音を先に読み込んでおく（読み込めたら true）。inst は "violin" か "viola"
  async function prepare(ctx, inst, midis) {
    if (!(await loadScript(inst))) return false;
    try { await Promise.all([...new Set(midis.map(m => near(inst, m)))].map(m => decode(ctx, inst, m))); return true; }
    catch (e) { console.warn(inst + " の録音を開けませんでした", e); return false; }
  }
  // 1音を鳴らす。prepare のあとに使う。読み込めていない音は null を返す（呼んだ側で作った音にする）
  function note(ctx, inst, midi, t, dur, { gain = 1, rate = 1, dest = null, pan = 0 } = {}) {
    if (!window.STRING_SAMPLES || !window.STRING_SAMPLES[inst]) return null;
    const m = near(inst, midi), s = cache[inst + m]; if (!s) return null;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = s.buf; src.playbackRate.value = rate * Math.pow(2, (midi - m) / 12);
    const offset = dur < 0.6 ? 0.2 : 0.08;   // 出だしはゆっくり大きくなるので、短い音ほど少し先から鳴らす
    if (offset + dur * src.playbackRate.value > s.b - 0.05) { src.loop = true; src.loopStart = s.a; src.loopEnd = s.b; }
    const rel = Math.min(0.08, dur * 0.3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.setValueAtTime(gain, Math.max(t + 0.02, t + dur - rel)); g.gain.linearRampToValueAtTime(0, t + dur);
    let out = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    src.connect(g); out.connect(dest || ctx.destination);
    src.start(t, offset); src.stop(t + dur + 0.02);
    return src;
  }
  window.StringVoice = { prepare, note };
})();
