/* チェロの声：本物のチェロの録音で音を鳴らす共通の部品（調弦・楽譜帳・道で使う）。
   録音は FluidR3 GM（Frank Wen 作、CC BY 3.0）を1音ずつ抜き出したもの（同じ場所の cello-samples.js、約1.3MB）。
   録音は約3秒なので、それより長い音は録音のまん中（1〜3秒）を、つなぎ目をなめらかにして繰り返して伸ばす。
   録音は A=440 で録られている。A=442 などにするときは rate（再生の速さ）で高さを合わせる。 */
(() => {
  const BASE = document.currentScript ? new URL(".", document.currentScript.src).href : "art/";
  const LO = 36, HI = 74;              // 録音がある範囲（C2〜D5）
  const LOOP_A = 1.0, LOOP_B = 3.0, XF = 0.3;
  const cache = {};                    // MIDI 番号 → { buf, a, b }
  let loading = null;

  function loadScript() {
    if (window.CELLO_SAMPLES) return Promise.resolve(true);
    if (!loading) loading = new Promise(ok => {
      const s = document.createElement("script");
      s.src = BASE + "cello-samples.js";
      s.onload = () => ok(!!window.CELLO_SAMPLES);
      s.onerror = () => { loading = null; console.warn("チェロの録音を読み込めませんでした"); ok(false); };
      document.head.append(s);
    });
    return loading;
  }
  // 範囲外の音は、いちばん近い録音を速く・遅く再生して出す
  const near = m => Math.max(LO, Math.min(HI, Math.round(m)));

  // つなぎ目の手前で、ループの始まりの直前の音へ少しずつ入れ替えておくと、繰り返しても「ぷつっ」と鳴らない
  function makeLoop(ctx, src) {
    const sr = src.sampleRate, b = Math.min(Math.floor(LOOP_B * sr), src.length - 1), a = Math.floor(LOOP_A * sr), x = Math.floor(XF * sr);
    if (b - a < 2 * x || a < x) return { buf: src, a: 0, b: src.duration };
    const out = ctx.createBuffer(src.numberOfChannels, src.length, sr);
    for (let c = 0; c < src.numberOfChannels; c++) {
      const d = src.getChannelData(c), o = out.getChannelData(c);
      o.set(d);
      for (let i = 0; i < x; i++) { const w = (i / x) * Math.PI / 2; o[b - x + i] = d[b - x + i] * Math.cos(w) + d[a - x + i] * Math.sin(w); }
    }
    return { buf: out, a: a / sr, b: b / sr };
  }

  async function decode(ctx, m) {
    if (cache[m]) return cache[m];
    const url = window.CELLO_SAMPLES && window.CELLO_SAMPLES[m];
    if (!url) return null;
    const bin = atob(url.slice(url.indexOf(",") + 1)), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const buf = await new Promise((ok, ng) => ctx.decodeAudioData(bytes.buffer, ok, ng));
    cache[m] = makeLoop(ctx, buf);
    return cache[m];
  }

  // 使う音を先に読み込んでおく（読み込めたら true）
  async function prepare(ctx, midis) {
    if (!(await loadScript())) return false;
    try { await Promise.all([...new Set(midis.map(near))].map(m => decode(ctx, m))); return true; }
    catch (e) { console.warn("チェロの録音を開けませんでした", e); return false; }
  }

  // 1音を鳴らす。prepare のあとに使う。読み込めていない音は null を返す（呼んだ側で作った音にする）
  function note(ctx, midi, t, dur, { gain = 1.4, rate = 1, dest = null } = {}) {
    const m = near(midi), s = cache[m]; if (!s) return null;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = s.buf; src.playbackRate.value = rate * Math.pow(2, (midi - m) / 12);
    // 録音の出だしはゆっくり大きくなるので、短い音ほど少し先から鳴らして、すぐ聞こえるようにする
    const offset = dur < 0.6 ? 0.25 : 0.12;
    if (offset + dur * src.playbackRate.value > s.b - 0.05) { src.loop = true; src.loopStart = s.a; src.loopEnd = s.b; }
    const rel = Math.min(0.08, dur * 0.3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.setValueAtTime(gain, Math.max(t + 0.02, t + dur - rel)); g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(g).connect(dest || ctx.destination);
    src.start(t, offset); src.stop(t + dur + 0.02);
    return src;
  }

  // 録音の倍音の強さ（音色）を測る。録音にはビブラート（±5〜8セント）があるので、各倍音の近く ±1.5% で一番強いところを取る
  const waves = {};
  function harmonics(s, midi, n = 24) {
    const b = s.buf, sr = b.sampleRate, d = b.getChannelData(0), i0 = Math.floor(1.0 * sr), i1 = Math.min(d.length, Math.floor(2.5 * sr));
    const f0 = 440 * Math.pow(2, (midi - 69) / 12), amps = [];
    for (let k = 1; k <= n; k++) {
      let best = 0;
      for (let dev = -0.015; dev <= 0.0151; dev += 0.005) {
        const f = k * f0 * (1 + dev); if (f > sr / 4 - 200) break;      // 1つおきに見るので、測れるのは sr/4 まで（チェロの音色には十分）
        const w = 2 * Math.PI * f * 2 / sr, cw = 2 * Math.cos(w); let s1 = 0, s2 = 0;
        for (let i = i0; i < i1; i += 2) { const s0 = d[i] + cw * s1 - s2; s2 = s1; s1 = s0; }
        const mag = Math.sqrt(s1 * s1 + s2 * s2 - cw * s1 * s2);
        if (mag > best) best = mag;
      }
      amps.push(best);
    }
    const top = Math.max(...amps) || 1;
    return amps.map(a => a / top);
  }
  // 止めるまで鳴らし続ける（調弦の基準の音）。録音そのものはビブラートで高さが揺れるので、
  // 録音から測ったチェロの音色（倍音の強さ）を、揺れのない正確な高さで鳴らす。戻り値の stop() で、ふわっと止まる
  function hold(ctx, midi, { gain = 0.22, rate = 1 } = {}) {
    const m = near(midi), s = cache[m]; if (!s) return null;
    if (!waves[m]) waves[m] = harmonics(s, m);
    const amps = waves[m], real = new Float32Array(amps.length + 1), imag = new Float32Array(amps.length + 1);
    amps.forEach((a, k) => { imag[k + 1] = a; });
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12) * rate;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.12);
    o.connect(g).connect(ctx.destination); o.start(t);
    return { stop(fade = 0.25) { const n = ctx.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + fade); try { o.stop(n + fade + 0.02); } catch (e) { /* もう止まっている */ } } };
  }

  window.CelloVoice = { prepare, note, hold, ready: () => !!window.CELLO_SAMPLES };
})();
