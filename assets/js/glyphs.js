/*
 * Animated research glyphs (SVG, 120×120): a skeleton cycling through actions,
 * a hand typing on air keys, a tracker following an object, and a sequence
 * with a forecast. Each glyph only animates while it is on screen.
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function set(n, attrs) { for (var k in attrs) n.setAttribute(k, attrs[k]); }
  function line(n, a, b) { set(n, { x1: a[0].toFixed(2), y1: a[1].toFixed(2), x2: b[0].toFixed(2), y2: b[1].toFixed(2) }); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }

  // ------------------------------------------------------------ skeleton
  // Proportions: torso 32, upper arm 13, forearm 12, thigh/shin 19.
  function skeleton(svg) {
    el("ellipse", { class: "soft", cx: 60, cy: 107, rx: 22, ry: 3 }, svg);
    var gB = el("g", {}, svg), gJ = el("g", {}, svg);
    var head = el("circle", { class: "bone", r: 7.5 }, svg);
    var lines = [], glows = [], dots = [];
    var POSES = [
      function (t) { return { la: 0.15, lb: 0.1, ra: 2.5, rb: 0.3 + 0.55 * Math.sin(t * 7), bounce: 0 }; },
      function (t) { var o = 0.32 * (0.5 + 0.5 * Math.sin(t * 8)); return { la: 0.5, lb: -1.75 + o, ra: 0.5, rb: -1.75 + o, bounce: 0 }; },
      function (t) { var s = Math.sin(t * 5); return { la: 2.75 + 0.12 * s, lb: 0.2 * s, ra: 2.75 + 0.12 * s, rb: -0.2 * s, bounce: Math.abs(s) }; },
      function (t) { return { la: 0.9 + 0.35 * Math.sin(t * 4), lb: 1.2, ra: 0.9 + 0.35 * Math.sin(t * 4 + Math.PI), rb: 1.2, bounce: 0.5 + 0.5 * Math.sin(t * 8) }; },
    ];
    var J = 13; // neck, pelvis, shoulders, elbows, wrists, hips, knees, ankles
    var prev = null, att = [];
    for (var i = 0; i < 14; i++) lines.push(el("line", { class: "bone" }, gB));
    for (var j = 0; j < J; j++) {
      glows.push(el("circle", { class: "glow", r: 0 }, gJ));
      dots.push(el("circle", { class: "j", r: 2.2 }, gJ));
      att.push(0);
    }

    function joints(p) {
      var by = -2.2 * p.bounce;
      var neck = [60, 34 + by], pel = [60, 66 + by];
      var lS = [49, 37 + by], rS = [71, 37 + by];
      function arm(S, side, a, b) {
        var E = [S[0] + side * 13 * Math.sin(a), S[1] + 13 * Math.cos(a)];
        var W = [E[0] + side * 12 * Math.sin(a + b), E[1] + 12 * Math.cos(a + b)];
        return [E, W];
      }
      var L = arm(lS, -1, p.la, p.lb), R = arm(rS, 1, p.ra, p.rb);
      var knee = 2.2 * p.bounce;
      var lH = [55, 67 + by], rH = [65, 67 + by];
      var lK = [53 - knee, 86 + by * 0.5], rK = [67 + knee, 86 + by * 0.5];
      var lA = [52, 105], rA = [68, 105];
      return [neck, pel, lS, L[0], L[1], rS, R[0], R[1], lH, lK, lA, rH, rK, rA];
    }
    var SEG = [[0, 1], [0, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10], [1, 11], [11, 12], [12, 13], [8, 11]];

    return function (t, dt) {
      var period = 2.8, n = POSES.length;
      var k = (t / period) % n, i0 = Math.floor(k), f = k - i0;
      var a = POSES[i0](t), b = POSES[(i0 + 1) % n](t);
      var m = ease(Math.max(0, (f - 0.78) / 0.22));
      var p = {};
      for (var key in a) p[key] = lerp(a[key], b[key], m);
      var pts = joints(p);
      var headC = [pts[0][0], pts[0][1] - 10];
      set(head, { cx: headC[0].toFixed(2), cy: headC[1].toFixed(2) });
      SEG.forEach(function (s, idx) { line(lines[idx], pts[s[0]], pts[s[1]]); });
      for (var q = 0; q < J; q++) {
        var pt = pts[q === 0 ? 0 : q + 1];
        if (prev) {
          var v = Math.hypot(pt[0] - prev[q][0], pt[1] - prev[q][1]) / Math.max(dt, 1e-3);
          att[q] += (Math.min(1, v / 55) - att[q]) * Math.min(1, dt * 6);
        }
        set(dots[q], { cx: pt[0].toFixed(2), cy: pt[1].toFixed(2), r: (2 + 1.8 * att[q]).toFixed(2) });
        set(glows[q], { cx: pt[0].toFixed(2), cy: pt[1].toFixed(2), r: (3 + 7 * att[q]).toFixed(2), opacity: (0.45 * att[q]).toFixed(3) });
      }
      prev = [];
      for (var r = 0; r < J; r++) prev.push(pts[r === 0 ? 0 : r + 1].slice());
    };
  }

  // ---------------------------------------------------------------- hand
  function hand(svg) {
    var wrist = [60, 106];
    var FINGERS = [
      { base: [47, 92], ang: -0.95, len: [11, 9, 7] },   // thumb (from CMC)
      { base: [48, 66], ang: -0.14, len: [12, 9, 7] },
      { base: [59, 62], ang: -0.03, len: [13, 10, 7] },
      { base: [70, 64], ang: 0.08, len: [12, 9, 7] },
      { base: [79, 70], ang: 0.2, len: [9, 7, 6] },
    ];
    var gK = el("g", {}, svg), gB = el("g", {}, svg), gJ = el("g", {}, svg);
    var keys = [], bones = [], tips = [], joints = [];
    FINGERS.forEach(function (f, i) {
      keys.push(i ? el("rect", { class: "key", width: 15, height: 8, rx: 2.5 }, gK) : null); // no key for the thumb
    });
    var palm = [];
    for (var i = 0; i < 6; i++) palm.push(el("line", { class: "bone" }, gB));
    FINGERS.forEach(function () {
      bones.push([el("line", { class: "bone" }, gB), el("line", { class: "bone" }, gB), el("line", { class: "bone" }, gB)]);
      joints.push([el("circle", { class: "j", r: 1.8 }, gJ), el("circle", { class: "j", r: 1.8 }, gJ)]);
      tips.push(el("circle", { class: "j", r: 2.6 }, gJ));
    });
    el("circle", { class: "j", cx: wrist[0], cy: wrist[1], r: 3 }, gJ);

    var SEQ = [1, 3, 2, 4, 1, 2, 0, 3, 1, 4, 2, 0];
    var STEP = 0.32;
    var restTips = FINGERS.map(function (f) {
      var a = f.ang, L = f.len[0] + f.len[1] + f.len[2];
      return [f.base[0] + Math.sin(a) * L, f.base[1] - Math.cos(a) * L];
    });

    return function (t) {
      var idx = Math.floor(t / STEP), ph = (t / STEP) % 1;
      var active = SEQ[idx % SEQ.length];
      FINGERS.forEach(function (f, i) {
        var flex = i === active ? Math.sin(Math.PI * Math.min(1, ph * 1.4)) : 0;
        var p = f.base.slice(), pts = [p];
        f.len.forEach(function (L, s) {
          var a = f.ang + (i === 0 ? 0.32 : 0.0) * s; // the thumb curls upward
          var l = L * (1 - 0.5 * flex * (s + 1) / 3);
          p = [p[0] + Math.sin(a) * l, p[1] - Math.cos(a) * l + flex * 1.6 * s];
          pts.push(p);
        });
        for (var s = 0; s < 3; s++) line(bones[i][s], pts[s], pts[s + 1]);
        set(joints[i][0], { cx: pts[1][0].toFixed(2), cy: pts[1][1].toFixed(2) });
        set(joints[i][1], { cx: pts[2][0].toFixed(2), cy: pts[2][1].toFixed(2) });
        set(tips[i], { cx: pts[3][0].toFixed(2), cy: pts[3][1].toFixed(2), r: (2.6 + 1.6 * flex).toFixed(2) });
        var rt = restTips[i];
        if (keys[i]) set(keys[i], { x: (rt[0] - 7.5).toFixed(2), y: (rt[1] - 17).toFixed(2), class: flex > 0.55 ? "key on" : "key" });
      });
      var b = FINGERS.map(function (f) { return f.base; });
      line(palm[0], wrist, b[0]);
      line(palm[1], wrist, b[1]);
      line(palm[2], b[1], b[2]);
      line(palm[3], b[2], b[3]);
      line(palm[4], b[3], b[4]);
      line(palm[5], wrist, b[4]);
    };
  }

  // -------------------------------------------------------------- tracker
  function tracker(svg) {
    el("rect", { class: "soft", x: 8, y: 18, width: 104, height: 84, rx: 9 }, svg);
    var grid = el("path", { class: "faint", d: "M42.7 18v84M77.3 18v84M8 46h104M8 74h104" }, svg);
    var scan = el("line", { class: "scan", x1: 9, x2: 111 }, svg);
    var trail = [], trailDots = [];
    for (var i = 0; i < 14; i++) trailDots.push(el("circle", { class: "trail", r: 1.3 }, svg));
    var obj = el("g", {}, svg);
    var body = el("circle", { class: "obj", r: 5.5 }, obj);
    var box = el("path", { class: "accent" }, svg);
    var conf = el("rect", { class: "conf", height: 3, rx: 1.5 }, svg);
    var bx = 60, by = 60, last = 0;

    return function (t, dt) {
      var ox = 60 + 34 * Math.sin(t * 0.9), oy = 60 + 22 * Math.sin(t * 1.4 + 1);
      set(body, { cx: ox.toFixed(2), cy: oy.toFixed(2) });
      var k = 1 - Math.exp(-dt * 7);
      bx += (ox - bx) * k; by += (oy - by) * k;
      var s = 12 + 1.2 * Math.sin(t * 3), c = 5;
      var x0 = bx - s, x1 = bx + s, y0 = by - s, y1 = by + s;
      set(box, {
        d: "M" + x0 + " " + (y0 + c) + "V" + y0 + "H" + (x0 + c) + "M" + (x1 - c) + " " + y0 + "H" + x1 + "V" + (y0 + c) +
          "M" + x1 + " " + (y1 - c) + "V" + y1 + "H" + (x1 - c) + "M" + (x0 + c) + " " + y1 + "H" + x0 + "V" + (y1 - c),
      });
      var err = Math.hypot(ox - bx, oy - by);
      set(conf, { x: x0.toFixed(2), y: (y0 - 6).toFixed(2), width: Math.max(4, 2 * s * (1 - Math.min(1, err / 14))).toFixed(2) });
      if (t - last > 0.09) {
        trail.push([bx, by]); if (trail.length > trailDots.length) trail.shift(); last = t;
      }
      trailDots.forEach(function (d, i) {
        var p = trail[i];
        if (!p) { d.setAttribute("opacity", 0); return; }
        set(d, { cx: p[0].toFixed(2), cy: p[1].toFixed(2), opacity: ((i + 1) / trail.length * 0.7).toFixed(2) });
      });
      var sy = 18 + ((t * 30) % 84);
      set(scan, { y1: sy.toFixed(2), y2: sy.toFixed(2) });
    };
  }

  // ------------------------------------------------------------- sequence
  function sequence(svg) {
    el("line", { class: "soft", x1: 10, y1: 100, x2: 110, y2: 100 }, svg);
    var now = el("line", { class: "faint dash", x1: 80, x2: 80, y1: 22, y2: 100 }, svg);
    var band = el("path", { class: "band" }, svg);
    var past = el("path", { class: "bone", fill: "none" }, svg);
    var fut = el("path", { class: "accent dash" }, svg);
    var dot = el("circle", { class: "j", r: 3.2 }, svg);
    var cells = [];
    for (var i = 0; i < 7; i++) cells.push(el("rect", { class: "cell", x: 14 + i * 9, y: 106, width: 6, height: 6, rx: 1.5 }, svg));
    var N = 22, X0 = 12, DX = 4.6, NOW = 15;
    function v(s) { return 62 + 14 * Math.sin(s * 0.5) + 7 * Math.sin(s * 1.3 + 1) + 3.5 * Math.sin(s * 2.9); }

    return function (t) {
      var off = t * 1.5, dp = "", df = "", up = [], lo = [];
      for (var i = 0; i < N; i++) {
        var x = X0 + i * DX, y = v(i * 0.45 + off);
        if (i <= NOW) dp += (i ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2);
        if (i >= NOW) {
          df += (i === NOW ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
          var w = (i - NOW) * 2.2;
          up.push(x.toFixed(2) + " " + (y - w).toFixed(2));
          lo.unshift(x.toFixed(2) + " " + (y + w).toFixed(2));
        }
        if (i === NOW) set(dot, { cx: x.toFixed(2), cy: y.toFixed(2), r: (3 + 0.8 * Math.sin(t * 6)).toFixed(2) });
      }
      set(past, { d: dp });
      set(fut, { d: df });
      set(band, { d: "M" + up.join("L") + "L" + lo.join("L") + "Z" });
      set(now, { x1: X0 + NOW * DX, x2: X0 + NOW * DX });
      var active = Math.floor(t * 4) % cells.length;
      cells.forEach(function (c, i) { c.setAttribute("class", i === active ? "cell on" : i < active ? "cell seen" : "cell"); });
    };
  }

  // ------------------------------------------------------------------ bev
  // Left: dashcam perspective of a road with a crack approaching. Right: the same
  // road plane seen from above (inverse perspective mapping), sized in metres.
  function bev(svg) {
    var HOR = 16, K = 188, HALF = 2;            // horizon y, focal factor, half road width (m)
    function persp(xm, d) { var y = HOR + K / d, hw = 47 * (y - HOR) / 94; return [55 + xm / HALF * hw, y]; }
    function top(xm, d) { return [185 + xm * 17.5, 116 - (d - 2) / 18 * 106]; }
    el("path", { class: "soft", d: "M8 112L48 " + (HOR + K / 20).toFixed(1) + "H62L102 112Z" }, svg);
    el("rect", { class: "soft", x: 150, y: 10, width: 70, height: 106, rx: 3 }, svg);
    var grid = "";
    for (var m = 4; m <= 20; m += 4) { var gy = top(0, m)[1].toFixed(1); grid += "M150 " + gy + "H220"; }
    el("path", { class: "faint", d: grid }, svg);
    el("path", { class: "accent", d: "M112 64h22m-6-5 6 5-6 5" }, svg);
    var hLbl = el("text", { class: "lbl", x: 123, y: 56, "text-anchor": "middle" }, svg);
    hLbl.textContent = "H";
    var dashP = [], dashT = [];
    for (var i = 0; i < 6; i++) { dashP.push(el("line", { class: "bone" }, svg)); dashT.push(el("line", { class: "bone" }, svg)); }
    var crackP = el("path", { class: "crack" }, svg), crackT = el("path", { class: "crack" }, svg);
    var boxP = el("rect", { class: "accent", rx: 2 }, svg), boxT = el("rect", { class: "accent", rx: 2 }, svg);
    var size = el("text", { class: "lbl" }, svg);
    var CRACK = [[-0.6, 0], [-0.35, 0.18], [-0.1, -0.05], [0.15, 0.2], [0.4, 0.02], [0.6, 0.15]];

    function poly(map, d) {
      return CRACK.map(function (c, i) { var p = map(c[0] + 0.1, d + c[1]); return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("");
    }
    function bbox(node, map, d) {
      var xs = [], ys = [];
      CRACK.forEach(function (c) { var p = map(c[0] + 0.1, d + c[1]); xs.push(p[0]); ys.push(p[1]); });
      var x0 = Math.min.apply(0, xs) - 3, y0 = Math.min.apply(0, ys) - 3;
      set(node, { x: x0.toFixed(1), y: y0.toFixed(1), width: (Math.max.apply(0, xs) - x0 + 3).toFixed(1), height: (Math.max.apply(0, ys) - y0 + 3).toFixed(1) });
      return [x0, y0];
    }

    return function (t) {
      var speed = 3.2;
      for (var i = 0; i < 6; i++) {
        var d = ((i * 3 - t * speed) % 18 + 18) % 18 + 2.5;
        line(dashP[i], persp(0, d), persp(0, Math.min(20, d + 1.2)));
        line(dashT[i], top(0, d), top(0, Math.min(20, d + 1.2)));
      }
      var dc = 20 - ((t * speed + 4) % 17);
      set(crackP, { d: poly(persp, dc) });
      set(crackT, { d: poly(top, dc) });
      bbox(boxP, persp, dc);
      var b = bbox(boxT, top, dc);
      set(size, { x: (b[0] - 3).toFixed(1), y: (b[1] - 3).toFixed(1), "text-anchor": "end" });
      size.textContent = "1.2 m";
      var vis = dc < 19 ? 1 : 0;
      [crackP, crackT, boxP, boxT, size].forEach(function (n) { n.setAttribute("opacity", vis); });
    };
  }

  var MAKERS = { skeleton: skeleton, hand: hand, eye: tracker, graph: sequence, bev: bev };
  var live = [];
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      live.forEach(function (g) { if (g.svg === en.target) g.visible = en.isIntersecting; });
    });
  }) : null;

  function mount(container) {
    live = live.filter(function (g) { return document.contains(g.svg); });
    container.querySelectorAll("svg[data-glyph]").forEach(function (svg) {
      if (svg.__glyph) return;
      var make = MAKERS[svg.getAttribute("data-glyph")];
      if (!make) return;
      var g = { svg: svg, draw: make(svg), visible: !io, t: Math.random() * 10 };
      svg.__glyph = g;
      g.draw(g.t, 0.016);
      live.push(g);
      if (io) io.observe(svg);
    });
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) live.forEach(function (g) { if (g.visible) { g.t += dt; g.draw(g.t, dt); } });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.Glyphs = { mount: mount };
})();
