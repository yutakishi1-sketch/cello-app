/* 天文時計の文字盤（メトロノーム用）。プラハの天文時計を下敷きに、夜の青と金で華やかに描く。
   外の帯＝速さの目盛り（40〜208）、金の太陽の針＝今の速さ、中心のずれた金の黄道の輪＝拍に合わせてなめらかに回る（1拍30°）、細い拍の針＝1小節で1周。
   描くだけの部品：音は持たない。呼ぶ側が beat(拍の時刻, 何拍目) を渡し、毎コマ frame(今の時刻) を呼ぶ。
   OrlojDial.create(svg要素, { bpm, beats }) → { setBpm, setBeats, beat, reset, frame, bpmAtPoint } */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const C = { gold: "#c9a54e", goldS: "#e0c272", hi: "#ffe39a", dim: "#6e5a2c", deep: "#1a1408", line: "#3a3322", sub: "#8f95a1", band: "#0a0f1a", ring: "#111a2c", sky: "#16244a", sky2: "#0f1a35", night: "#0b1322", dusk: "rgba(196,128,62,.12)" };
  const LAT = "'Cormorant Garamond',Garamond,serif";
  const MARKS = [40, 50, 60, 72, 84, 100, 120, 144, 168, 208], SPAN = 140;   // 本物のメトロノームの刻み。左右140°に等間隔
  const ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  const pol = (cx, cy, r, deg) => { const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const arc = (cx, cy, r, a0, a1) => { const [x0, y0] = pol(cx, cy, r, a0), [x1, y1] = pol(cx, cy, r, a1); return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
  const angOf = b => { b = Math.max(40, Math.min(208, b)); let i = 0; while (i < MARKS.length - 2 && b > MARKS[i + 1]) i++; const f = (b - MARKS[i]) / (MARKS[i + 1] - MARKS[i]); return -SPAN + (i + f) * (2 * SPAN / (MARKS.length - 1)); };
  const bpmOf = a => { const step = 2 * SPAN / (MARKS.length - 1), x = (Math.max(-SPAN, Math.min(SPAN, a)) + SPAN) / step, i = Math.min(MARKS.length - 2, Math.floor(x)); return MARKS[i] + (x - i) * (MARKS[i + 1] - MARKS[i]); };

  function create(sv, { bpm = 72, beats = 4 } = {}) {
    const CX = 170, CY = 170, uid = "od" + Math.random().toString(36).slice(2, 7);
    sv.setAttribute("viewBox", "-20 -20 380 380"); sv.innerHTML = "";
    const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); (p || sv).append(e); return e; };
    // 金の金属感（斜めのグラデーション）と、空の奥行き
    const defs = el("defs", {});
    const g1 = el("linearGradient", { id: uid + "g", x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    [[0, "#7d6530"], [0.3, "#f0d98f"], [0.5, "#c9a54e"], [0.75, "#ffe9a8"], [1, "#6e5a2c"]].forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, g1));
    const g2 = el("radialGradient", { id: uid + "s", cx: 0.5, cy: 0.75, r: 0.8 }, defs);
    [[0, C.sky], [1, C.sky2]].forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, g2));
    const GOLD = `url(#${uid}g)`;

    // ── 四角い枠（石の額）：文字盤のまわりの四隅に、角ばったゴシックの金の装飾。柔らかい曲線は使わない
    const F0 = -20, F1 = 360;
    el("path", { d: `M${F0} ${F0}H${F1}V${F1}H${F0}ZM${CX + 152} ${CY}A152 152 0 1 0 ${CX - 152} ${CY}A152 152 0 1 0 ${CX + 152} ${CY}Z`, fill: "#0f1727", "fill-rule": "evenodd" });
    el("rect", { x: F0 + 1, y: F0 + 1, width: F1 - F0 - 2, height: F1 - F0 - 2, fill: "none", stroke: GOLD, "stroke-width": 2 });
    el("rect", { x: F0 + 6, y: F0 + 6, width: F1 - F0 - 12, height: F1 - F0 - 12, fill: "none", stroke: C.dim, "stroke-width": 0.8 });
    el("rect", { x: F0 + 10, y: F0 + 10, width: F1 - F0 - 20, height: F1 - F0 - 20, fill: "none", stroke: C.gold, "stroke-width": 0.8 });
    // 内側の縁のぎざ（内向きの小さな三角）
    let saw = "";
    for (let v = F0 + 22; v <= F1 - 22; v += 12) {
      saw += `M${v - 3} ${F0 + 10}L${v} ${F0 + 15}L${v + 3} ${F0 + 10}M${v - 3} ${F1 - 10}L${v} ${F1 - 15}L${v + 3} ${F1 - 10}`;
      saw += `M${F0 + 10} ${v - 3}L${F0 + 15} ${v}L${F0 + 10} ${v + 3}M${F1 - 10} ${v - 3}L${F1 - 15} ${v}L${F1 - 10} ${v + 3}`;
    }
    el("path", { d: saw, fill: "none", stroke: C.dim, "stroke-width": 0.8 });
    const star = (x, y, R, r, fill) => { let d = ""; for (let i = 0; i < 16; i++) { const [px, py] = pol(x, y, i % 2 ? r : (i % 4 ? R * 0.62 : R), i * 22.5); d += (i ? "L" : "M") + px + " " + py; } el("path", { d: d + "Z", fill, stroke: C.deep, "stroke-width": 0.6 }); };
    const diamond = (x, y, k, fill) => el("path", { d: `M${x} ${y - k}l${k} ${k}l${-k} ${k}l${-k} ${-k}z`, fill });
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      const px = CX + sx * 158, py = CY + sy * 158;
      // 隅から縁に沿って伸びる金の線と、先の菱形
      el("path", { d: `M${px} ${py}V${CY + sy * 66}M${px} ${py}H${CX + sx * 66}`, stroke: C.gold, "stroke-width": 0.9 });
      el("path", { d: `M${px - sx * 8} ${py}V${CY + sy * 92}M${px} ${py - sy * 8}H${CX + sx * 92}`, stroke: C.dim, "stroke-width": 0.7 });
      diamond(px, CY + sy * 62, 4, C.goldS); diamond(CX + sx * 62, py, 4, C.goldS);
      // 隅から円へ向かう尖った光（対角線の上の菱形の列）
      [[132, 3.4], [120, 2.4]].forEach(([d, k]) => diamond(CX + sx * d, CY + sy * d, k, C.gold));
      el("path", { d: `M${px} ${py}L${CX + sx * 140} ${CY + sy * 140}`, stroke: C.gold, "stroke-width": 0.9 });
      // 隅の八方の星（羅針盤の星）
      el("circle", { cx: px, cy: py, r: 19, fill: "none", stroke: C.dim, "stroke-width": 0.7 });
      star(px, py, 17, 4.2, GOLD);
      el("circle", { cx: px, cy: py, r: 2.6, fill: C.deep, stroke: C.goldS, "stroke-width": 0.8 });
    });
    // 四辺のまん中：要石（尖った菱形）と左右の線
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => {
      const x = CX + dx * 167, y = CY + dy * 167, ox = dy ? 1 : 0, oy = dx ? 1 : 0;
      el("path", { d: `M${x - ox * 44} ${y - oy * 44}L${x - ox * 12} ${y - oy * 12}M${x + ox * 12} ${y + oy * 12}L${x + ox * 44} ${y + oy * 44}`, stroke: C.gold, "stroke-width": 0.9 });
      diamond(x - ox * 46, y - oy * 46, 2.4, C.gold); diamond(x + ox * 46, y + oy * 46, 2.4, C.gold);
      el("path", { d: `M${x} ${y - 9}L${x + 6} ${y}L${x} ${y + 9}L${x - 6} ${y}Z`, fill: GOLD, stroke: C.deep, "stroke-width": 0.6, transform: dx ? `rotate(90 ${x} ${y})` : "" });
    });
    // 文字盤のいちばん外：細かい歯の輪（機械の刻み）
    for (let i = 0; i < 180; i++) { const a = i * 2, long = i % 15 === 0, [x1, y1] = pol(CX, CY, 145, a), [x2, y2] = pol(CX, CY, long ? 152 : 149, a); el("line", { x1, y1, x2, y2, stroke: long ? C.goldS : C.dim, "stroke-width": long ? 1.3 : 0.7 }); }
    el("circle", { cx: CX, cy: CY, r: 152.5, fill: "none", stroke: GOLD, "stroke-width": 1.4 });

    // ── 外の帯：黒地に金の数字（速さ）
    el("circle", { cx: CX, cy: CY, r: 142, fill: C.band, stroke: GOLD, "stroke-width": 3 });
    el("circle", { cx: CX, cy: CY, r: 138.5, fill: "none", stroke: C.dim, "stroke-width": 0.6 });
    for (let a = -SPAN; a <= SPAN + 0.01; a += 2 * SPAN / 54) { const [x1, y1] = pol(CX, CY, 138, a), [x2, y2] = pol(CX, CY, 134, a); el("line", { x1, y1, x2, y2, stroke: C.dim, "stroke-width": 0.7 }); }
    MARKS.forEach(b => {
      const a = angOf(b), [x1, y1] = pol(CX, CY, 138.5, a), [x2, y2] = pol(CX, CY, 132, a), [tx, ty] = pol(CX, CY, 127, a);
      el("line", { x1, y1, x2, y2, stroke: C.goldS, "stroke-width": 1.4 });
      el("text", { x: tx, y: ty, "text-anchor": "middle", "dominant-baseline": "central", "font-family": LAT, "font-weight": 700, "font-size": 11.5, fill: C.goldS, transform: `rotate(${Math.abs(a) > 95 ? a - Math.sign(a) * 180 : a} ${tx} ${ty})` }).textContent = b;
    });
    // 目盛りの無い下の空き：金の飾り板
    el("path", { d: arc(CX, CY, 129, 152, 208), fill: "none", stroke: C.dim, "stroke-width": 0.8 });
    [-1, 0, 1].forEach(k => { const [x, y] = pol(CX, CY, 129, 180 + k * 14); el("path", { d: `M${x} ${y - 4}l4 4l-4 4l-4-4z`, fill: k ? C.dim : C.gold }); });
    el("circle", { cx: CX, cy: CY, r: 121, fill: "none", stroke: GOLD, "stroke-width": 2.4 });

    // ── ローマ数字の帯（天文時計の時の輪）
    el("circle", { cx: CX, cy: CY, r: 119.5, fill: C.ring });
    for (let i = 0; i < 12; i++) {
      const a = i * 30, [tx, ty] = pol(CX, CY, 113, a);
      el("text", { x: tx, y: ty, "text-anchor": "middle", "dominant-baseline": "central", "font-family": LAT, "font-weight": 700, "font-size": 8.5, fill: C.gold, "letter-spacing": "0.3", transform: `rotate(${a} ${tx} ${ty})` }).textContent = ROMAN[i];
      const [dx, dy] = pol(CX, CY, 113, a + 15); el("circle", { cx: dx, cy: dy, r: 1, fill: C.dim });
    }
    el("circle", { cx: CX, cy: CY, r: 106, fill: "none", stroke: GOLD, "stroke-width": 1.6 });

    // ── 内側：昼の空・夜明けと夕暮れ・夜（天文時計の色分けを、夜の青に合わせて抑えめに）
    el("circle", { cx: CX, cy: CY, r: 105, fill: C.night });
    el("path", { d: arc(CX, CY, 105, -90, 90) + "Z", fill: `url(#${uid}s)` });
    el("path", { d: `M${CX} ${CY}L${pol(CX, CY, 105, 90).join(" ")}A105 105 0 0 1 ${pol(CX, CY, 105, 108).join(" ")}Z`, fill: C.dusk });
    el("path", { d: `M${CX} ${CY}L${pol(CX, CY, 105, 252).join(" ")}A105 105 0 0 1 ${pol(CX, CY, 105, 270).join(" ")}Z`, fill: C.dusk });
    // 空の金の時の線（ゆるい弧）
    for (let i = 1; i < 12; i++) {
      const a = -90 + i * 15, [x1, y1] = pol(CX, CY, 34, a), [x2, y2] = pol(CX, CY, 104, a), [qx, qy] = pol(CX, CY, 72, a + (a < 0 ? -6 : 6));
      el("path", { d: `M${x1} ${y1}Q${qx} ${qy} ${x2} ${y2}`, fill: "none", stroke: C.gold, "stroke-width": 0.6, opacity: 0.35 });
    }
    // 夜の星
    [[-58, 40], [-30, 70], [44, 52], [70, 28], [-80, 18], [20, 84], [-12, 96], [88, 60]].forEach(([dx, dy], i) => el("circle", { cx: CX + dx, cy: CY + dy, r: i % 3 ? 0.9 : 1.3, fill: C.goldS, opacity: 0.55 }));
    el("path", { d: `M${CX - 105} ${CY}H${CX + 105}`, stroke: C.gold, "stroke-width": 0.8, opacity: 0.8 });
    [92, 70].forEach(r => el("circle", { cx: CX, cy: CY, r, fill: "none", stroke: C.line, "stroke-width": 0.7 }));

    // ── 夜の側：拍の灯り と ♩ = 速さ
    const lampG = el("g", {}), lamps = [];
    el("text", { x: CX - 4, y: CY + 88, "text-anchor": "end", "font-family": LAT, "font-size": 15, fill: C.sub }).textContent = "♩ =";
    const num = el("text", { x: CX + 2, y: CY + 90, "font-family": LAT, "font-weight": 700, "font-size": 28, fill: GOLD });

    // ── 黄道の輪（中心のずれた金の輪）。拍ごとに1こま進む
    const ZX = CX, ZY = CY - 24, ZR = 58, zod = el("g", {});
    const ringOuter = el("circle", { cx: ZX, cy: ZY, r: ZR + 12, fill: "none", stroke: C.gold, "stroke-width": 0.8 }, zod);
    el("circle", { cx: ZX, cy: ZY, r: ZR + 9, fill: "none", stroke: GOLD, "stroke-width": 1.4 }, zod);
    el("path", { d: `${arc(ZX, ZY, ZR + 8, 0, 180)}${arc(ZX, ZY, ZR + 8, 180, 359.99).replace(/^M[^A]+/, "")}M${pol(ZX, ZY, ZR - 8, 0).join(" ")}${arc(ZX, ZY, ZR - 8, 0, 180).replace(/^M[^A]+/, "")}${arc(ZX, ZY, ZR - 8, 180, 359.99).replace(/^M[^A]+/, "")}`, fill: GOLD, "fill-rule": "evenodd", opacity: 0.92 }, zod);
    el("circle", { cx: ZX, cy: ZY, r: ZR - 9, fill: "none", stroke: GOLD, "stroke-width": 1.2 }, zod);
    for (let i = 0; i < 12; i++) {
      const a = i * 30, [x1, y1] = pol(ZX, ZY, ZR + 8, a), [x2, y2] = pol(ZX, ZY, ZR - 8, a);
      el("line", { x1, y1, x2, y2, stroke: C.deep, "stroke-width": 0.9 }, zod);
      const [sx, sy] = pol(ZX, ZY, ZR, a + 15);
      const st = el("g", { transform: `translate(${sx} ${sy}) rotate(${a + 15})` }, zod);
      el("path", { d: "M0 -4.6l1.2 3.2l3.4 1.4l-3.4 1.4l-1.2 3.2l-1.2-3.2l-3.4-1.4l3.4-1.4z", fill: C.deep }, st);
    }
    for (let i = 0; i < 36; i++) { const [x, y] = pol(ZX, ZY, ZR + 12, i * 10 + 5); el("circle", { cx: x, cy: y, r: 0.9, fill: C.goldS }, zod); }

    // ── 拍の針：拍に合わせてなめらかに回る細い針（1小節で1周、小節の頭で真上）。先は小さな星
    const sweep = el("g", {});
    el("line", { x1: CX, y1: CY + 18, x2: CX, y2: CY - 100, stroke: C.gold, "stroke-width": 1.1, "stroke-linecap": "round", opacity: 0.9 }, sweep);
    el("path", { d: `M${CX} ${CY - 108}l2 5l5 2l-5 2l-2 5l-2-5l-5-2l5-2z`, fill: C.goldS }, sweep);
    el("circle", { cx: CX, cy: CY + 18, r: 2.6, fill: C.gold }, sweep);

    // ── 金の太陽の針：今の速さを指す（先は百合、後ろは三日月）
    const hand = el("g", {});
    el("line", { x1: CX, y1: CY + 26, x2: CX, y2: CY - 92, stroke: C.goldS, "stroke-width": 2.4, "stroke-linecap": "round" }, hand);   // 縦一直線の線にグラデーションは付かない（消える）ので単色
    el("path", { d: `M${CX} ${CY - 104}C${CX + 4} ${CY - 98} ${CX + 6} ${CY - 95} ${CX} ${CY - 90}C${CX - 6} ${CY - 95} ${CX - 4} ${CY - 98} ${CX} ${CY - 104}Z`, fill: C.goldS, stroke: C.deep, "stroke-width": 0.6 }, hand);
    el("path", { d: `M${CX} ${CY - 92}c4 -1 7 1 7 4c-3 -1 -5 -1 -7 0zM${CX} ${CY - 92}c-4 -1 -7 1 -7 4c3 -1 5 -1 7 0z`, fill: C.gold }, hand);
    el("path", { d: `M${CX - 7} ${CY + 30}A8 8 0 1 0 ${CX + 7} ${CY + 30}A6 6 0 1 1 ${CX - 7} ${CY + 30}Z`, fill: C.gold }, hand);
    const sunH = el("g", {}, hand), SY = CY - 74;
    for (let i = 0; i < 16; i++) { const [x1, y1] = pol(CX, SY, 10, i * 22.5), [x2, y2] = pol(CX, SY, i % 2 ? 14 : 18, i * 22.5); el("line", { x1, y1, x2, y2, stroke: C.goldS, "stroke-width": i % 2 ? 1 : 1.6 }, sunH); }
    el("circle", { cx: CX, cy: SY, r: 9, fill: GOLD, stroke: C.deep, "stroke-width": 0.8 }, sunH);
    el("circle", { cx: CX, cy: SY, r: 5.5, fill: "none", stroke: C.deep, "stroke-width": 0.6, opacity: 0.6 }, sunH);
    // 中心：月の玉（半分金・半分夜）と金の座金
    el("circle", { cx: CX, cy: CY, r: 12, fill: "none", stroke: GOLD, "stroke-width": 1.6 });
    el("circle", { cx: CX, cy: CY, r: 9, fill: C.night, stroke: C.gold, "stroke-width": 1 });
    el("path", { d: `M${CX} ${CY - 9}A9 9 0 0 1 ${CX} ${CY + 9}Z`, fill: GOLD });

    // ── 動き：輪と拍の針は、拍と拍のあいだを等速でなめらかに回す（止まって跳ぶ動きはしない）
    let want = bpm, handA = angOf(bpm), beatsT = [], last = null, count = 0, perBar = beats > 1 ? beats : 4, zodA = 0, sweepA = 0;
    function setBeats(n) {
      perBar = n > 1 ? n : 4;
      lampG.innerHTML = ""; lamps.length = 0;
      const k = Math.max(1, n), gap = k > 4 ? 15 : 20;
      for (let i = 0; i < k; i++) { const x = CX + (i - (k - 1) / 2) * gap, y = CY + 58; lamps.push(el("path", { d: `M${x} ${y - 6}l6 6l-6 6l-6-6z`, fill: "none", stroke: i === 0 && k > 1 ? C.goldS : C.dim, "stroke-width": 1.2 }, lampG)); }
    }
    setBeats(beats);
    return {
      setBpm(b) { want = b; },
      setBeats,
      beat(t, i) { beatsT.push({ t, i }); if (beatsT.length > 8) beatsT.shift(); },
      reset() { beatsT = []; last = null; },
      // now: 音の時計の今（無いときは null）。1コマ描く
      frame(now) {
        handA += (angOf(want) - handA) * 0.2; hand.setAttribute("transform", `rotate(${handA} ${CX} ${CY})`);
        num.textContent = Math.round(want);
        let glow = 0, lit = -1;
        if (now != null) {
          while (beatsT.length > 1 && beatsT[1].t <= now) beatsT.shift();
          const a = beatsT[0], b = beatsT[1];
          if (a && now >= a.t) {
            if (a !== last) { last = a; count++; }
            const f = Math.min(1, (now - a.t) / ((b ? b.t : a.t + 60 / want) - a.t));
            zodA = (count - 1 + f) * 30;                                        // 1拍で30°、等速で
            const inBar = a.i >= 0 ? a.i : (count - 1) % perBar;
            sweepA = (inBar + f) / perBar * 360;                                // 1小節で1周
            glow = Math.exp(-(now - a.t) / 0.12); lit = a.i;
          }
        }
        zod.setAttribute("transform", `rotate(${zodA} ${ZX} ${ZY})`);
        sweep.setAttribute("transform", `rotate(${sweepA} ${CX} ${CY})`);
        const strong = lit === 0 && lamps.length > 1;
        zod.style.filter = glow > 0.02 ? `drop-shadow(0 0 ${3 + 7 * glow}px rgba(255,227,154,${(glow * (strong ? 0.7 : 0.35)).toFixed(2)}))` : "none";
        sunH.style.filter = strong && glow > 0.02 ? `drop-shadow(0 0 ${4 + 10 * glow}px rgba(255,227,154,${glow.toFixed(2)}))` : "none";
        lamps.forEach((l, i) => l.setAttribute("fill", i === lit && glow > 0.05 ? C.goldS : "none"));
      },
      // 文字盤の上の点（svg の座標）から速さを読む。外の帯の近くを回すと速さが変わる
      pointOf(e) { const r = sv.getBoundingClientRect(), vb = sv.viewBox.baseVal; return { x: vb.x + (e.clientX - r.left) / r.width * vb.width, y: vb.y + (e.clientY - r.top) / r.height * vb.height }; },
      bpmAtPoint(x, y) { const a = Math.atan2(x - CX, -(y - CY)) * 180 / Math.PI; return Math.abs(a) <= SPAN + 8 ? bpmOf(a) : null; },
      center: [CX, CY],
    };
  }
  window.OrlojDial = { create };
})();
