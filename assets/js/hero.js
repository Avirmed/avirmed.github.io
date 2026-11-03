/*
 * Hero stage: a skeleton graph performing music-related actions, with joints
 * glowing by "attention" (here: joint speed, which is what a motion model keys on).
 * When hand mode is running, the stage switches to the visitor's live hand graph.
 */
(function () {
  "use strict";

  var canvas = document.getElementById("skeleton");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var stage = document.getElementById("stage");
  var tip = document.getElementById("joint-tip");
  var rowsEl = document.getElementById("infer-rows");
  var dotsEl = document.getElementById("action-dots");
  var modeEl = document.getElementById("infer-mode");

  var ACTIONS = ["morinkhuur", "drums", "conduct", "wave", "clap"];
  var ACTION_SECONDS = 5;

  var BODY_NAMES = [
    "Head", "Neck", "Spine", "Pelvis",
    "L.Shoulder", "L.Elbow", "L.Wrist", "L.Hand",
    "R.Shoulder", "R.Elbow", "R.Wrist", "R.Hand",
    "L.Hip", "L.Knee", "L.Ankle", "R.Hip", "R.Knee", "R.Ankle",
  ];
  var BODY_BONES = [
    [0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10], [10, 11],
    [3, 12], [12, 13], [13, 14], [3, 15], [15, 16], [16, 17],
  ];
  var HAND_NAMES = [
    "Wrist", "Thumb CMC", "Thumb MCP", "Thumb IP", "Thumb tip",
    "Index MCP", "Index PIP", "Index DIP", "Index tip",
    "Middle MCP", "Middle PIP", "Middle DIP", "Middle tip",
    "Ring MCP", "Ring PIP", "Ring DIP", "Ring tip",
    "Pinky MCP", "Pinky PIP", "Pinky DIP", "Pinky tip",
  ];
  var HAND_BONES = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
  ];
  var TRAILED = { 6: 1, 7: 1, 10: 1, 11: 1 };

  // ---- poses -------------------------------------------------------------
  // Arm angles: a = upper arm, measured from straight down, positive = outward.
  // b = elbow bend added to a for the forearm.
  function pose(action, t) {
    var s = Math.sin, p = { la: 0.12, lb: 0.1, ra: 0.12, rb: 0.1, head: 0, lean: 0, legs: 0, sit: 0 };
    switch (action) {
      case "morinkhuur":
        // seated, instrument upright between the knees; left hand stops the strings
        // on the neck, right hand draws the bow horizontally across them
        p.sit = 1;
        p.la = 0.75; p.lb = -2.55 + 0.07 * s(t * 9);
        p.ra = 0.38 + 0.1 * s(t * 1.8); p.rb = -1.0 + 0.5 * s(t * 1.8);
        p.head = -0.1 + 0.03 * s(t * 0.9); p.lean = 0.03 * s(t * 1.8);
        break;
      case "drums":
        p.la = 0.55; p.lb = 1.25 + 0.6 * s(t * 7);
        p.ra = 0.55; p.rb = 1.25 + 0.6 * s(t * 7 + Math.PI);
        p.head = 0.06 * s(t * 7); p.legs = 0.05 * s(t * 3.5);
        break;
      case "conduct":
        p.ra = 1.35 + 0.5 * s(t * 2.6); p.rb = 0.55 + 0.45 * s(t * 2.6 + 1.3);
        p.la = 0.95 + 0.12 * s(t * 1.3); p.lb = 1.0;
        p.lean = 0.03 * s(t * 2.6); p.head = 0.05 * s(t * 1.3);
        break;
      case "wave":
        p.ra = 2.55; p.rb = 0.25 + 0.5 * s(t * 5);
        p.la = 0.12; p.lb = 0.1; p.head = 0.08; p.lean = -0.02;
        break;
      case "clap":
        var o = 0.32 * (0.5 + 0.5 * s(t * 6.5));
        p.la = 0.5; p.lb = -1.75 + o; p.ra = 0.5; p.rb = -1.75 + o;
        p.head = 0.04 * s(t * 6.5);
        break;
    }
    return p;
  }

  function mixPose(a, b, k) {
    var out = {};
    for (var key in a) out[key] = a[key] + (b[key] - a[key]) * k;
    return out;
  }

  function bodyJoints(p, t) {
    var sway = 0.05 * Math.sin(t * 0.9);
    var j = [];
    var pel = [sway, 0], spine = [sway * 0.6, -1.3], neck = [sway * 0.3, -2.55];
    var head = [neck[0] + 0.72 * Math.sin(p.head), neck[1] - 0.72 * Math.cos(p.head)];
    var lS = [neck[0] - 0.85, -2.4], rS = [neck[0] + 0.85, -2.4];

    function arm(S, side, a, b) {
      var E = [S[0] + side * 1.15 * Math.sin(a), S[1] + 1.15 * Math.cos(a)];
      var W = [E[0] + side * 1.0 * Math.sin(a + b), E[1] + 1.0 * Math.cos(a + b)];
      var c = a + b + 0.15 * Math.sign(b || 1);
      var H = [W[0] + side * 0.32 * Math.sin(c), W[1] + 0.32 * Math.cos(c)];
      return [E, W, H];
    }
    var L = arm(lS, -1, p.la, p.lb), R = arm(rS, 1, p.ra, p.rb);

    // Seated: thighs point at the viewer (foreshortened) and spread; shins stay vertical.
    var thigh = 1.45 * (1 - 0.7 * p.sit), spread = 0.5 * p.sit;
    function leg(side, a) {
      var hip = [pel[0] + side * 0.42, 0.04];
      var K = [hip[0] + side * thigh * Math.sin(a + spread), hip[1] + thigh * Math.cos(a + spread)];
      var sa = (a - 0.12) * (1 - p.sit) + 0.05 * p.sit;
      var A = [K[0] + side * 1.4 * Math.sin(sa), K[1] + 1.4 * Math.cos(sa)];
      return [hip, K, A];
    }
    var LL = leg(-1, 0.09 + p.legs), RL = leg(1, 0.09 - p.legs);

    j.push(head, neck, spine, pel, lS, L[0], L[1], L[2], rS, R[0], R[1], R[2], LL[0], LL[1], LL[2], RL[0], RL[1], RL[2]);

    // lean the upper body around the pelvis
    var cl = Math.cos(p.lean), sl = Math.sin(p.lean);
    for (var i = 0; i < 12; i++) {
      if (i === 3) continue;
      var dx = j[i][0] - pel[0], dy = j[i][1] - pel[1];
      j[i] = [pel[0] + dx * cl - dy * sl, pel[1] + dx * sl + dy * cl];
    }
    // lower the whole body when seated so the feet stay on the ground
    var drop = 1.09 * p.sit;
    for (var m = 0; m < j.length; m++) j[m][1] += drop;
    return j;
  }

  // ---- state -------------------------------------------------------------
  var W = 0, H = 0, dpr = 1, u = 50, cx = 0, cy = 0;
  var colors = {};
  var actionIdx = 0, prevAction = "morinkhuur", blend = 1, actionStart = 0;
  var clock = 0, last = performance.now(), running = true, visible = true;
  var prevPts = null, att = [], trails = {};
  var mouse = null;
  var hand = null; // { pts, scores, at }
  var lastPanel = 0;
  var noise = ACTIONS.map(function () { return Math.random(); });

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ["--ink", "--ink-2", "--ink-3", "--accent", "--sky", "--rose", "--line-2", "--bg"].forEach(function (k) {
      colors[k.slice(2)] = cs.getPropertyValue(k).trim();
    });
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var compact = getComputedStyle(canvas).position !== "absolute";
    u = Math.min((H - (compact ? 30 : 120)) / 7.9, W / 5.2);
    cx = W / 2;
    cy = H - (compact ? 18 : 78) - 2.9 * u;
    prevPts = null; trails = {};
  }

  function setAction(i, manual) {
    prevAction = ACTIONS[actionIdx];
    actionIdx = (i + ACTIONS.length) % ACTIONS.length;
    blend = 0;
    actionStart = clock;
    noise = ACTIONS.map(function () { return Math.random(); });
    if (manual) autoPausedUntil = clock + 12;
    renderDots();
  }
  var autoPausedUntil = 0;

  function renderDots() {
    if (!dotsEl.children.length) {
      ACTIONS.forEach(function (a, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.addEventListener("click", function () { setAction(i, true); });
        dotsEl.appendChild(b);
      });
    }
    Array.prototype.forEach.call(dotsEl.children, function (b, i) {
      b.setAttribute("aria-pressed", String(i === actionIdx));
      b.setAttribute("aria-label", t("a." + ACTIONS[i]));
      b.title = t("a." + ACTIONS[i]);
    });
  }

  // ---- drawing -----------------------------------------------------------
  function toScreen(pt) { return [cx + pt[0] * u, cy + pt[1] * u]; }

  function alpha(hex, a) {
    if (!hex || hex[0] !== "#") return hex;
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }

  function updateAttention(pts, dt, scale) {
    if (!prevPts || prevPts.length !== pts.length) {
      prevPts = pts.map(function (p) { return p.slice(); });
      att = pts.map(function () { return 0; });
      return;
    }
    for (var i = 0; i < pts.length; i++) {
      var v = Math.hypot(pts[i][0] - prevPts[i][0], pts[i][1] - prevPts[i][1]) / Math.max(dt, 1e-3) / scale;
      var target = Math.min(1, v / 2.6);
      if (mouse) {
        var d = Math.hypot(pts[i][0] - mouse.x, pts[i][1] - mouse.y);
        target = Math.max(target, Math.exp(-(d * d) / (2 * 40 * 40)));
      }
      att[i] += (target - att[i]) * Math.min(1, dt * 5);
      prevPts[i][0] = pts[i][0]; prevPts[i][1] = pts[i][1];
    }
  }

  function drawTrails(pts) {
    for (var k in TRAILED) {
      var tr = trails[k] || (trails[k] = []);
      tr.push(pts[k].slice());
      if (tr.length > 26) tr.shift();
      for (var i = 1; i < tr.length; i++) {
        var a = i / tr.length;
        ctx.strokeStyle = alpha(colors.sky, 0.38 * a * a);
        ctx.lineWidth = 1 + 2.2 * a;
        ctx.beginPath(); ctx.moveTo(tr[i - 1][0], tr[i - 1][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke();
      }
    }
  }

  function drawProps(action, pts, k) {
    if (k <= 0.02) return;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.lineCap = "round";
    ctx.strokeStyle = alpha(colors["ink-3"], 0.85);
    var lh = pts[7], rh = pts[11], rw = pts[10], pel = pts[3];
    if (action === "morinkhuur") {
      drawMorinKhuur(pel, rh);
    } else if (action === "drums") {
      ctx.lineWidth = 1.5;
      [-1, 1].forEach(function (s) {
        ctx.beginPath(); ctx.ellipse(cx + s * 1.25 * u, cy - 0.35 * u, 0.62 * u, 0.17 * u, 0, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.lineWidth = 2.2;
      [[pts[6], pts[7]], [pts[10], pts[11]]].forEach(function (p) {
        var ex = p[1][0] - p[0][0], ey = p[1][1] - p[0][1], el = Math.hypot(ex, ey) || 1;
        ctx.beginPath(); ctx.moveTo(p[1][0], p[1][1]); ctx.lineTo(p[1][0] + ex / el * 0.8 * u, p[1][1] + ey / el * 0.8 * u); ctx.stroke();
      });
    } else if (action === "conduct") {
      var bx = rh[0] - rw[0], by = rh[1] - rw[1], bl = Math.hypot(bx, by) || 1;
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(rh[0], rh[1]); ctx.lineTo(rh[0] + bx / bl * 0.95 * u, rh[1] + by / bl * 0.95 * u); ctx.stroke();
    }
    ctx.restore();
  }

  // Morin khuur (horse-head fiddle): trapezoid sound box between the knees,
  // a long upright neck, two tuning pegs and the carved horse head on top.
  function drawMorinKhuur(pel, rh) {
    var x = pel[0] - 0.62 * u, P = function (dx, dy) { return [x + dx * u, pel[1] + dy * u]; };
    var stool = [cx, cy + 2.9 * u];
    // stool
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pel[0] - 0.7 * u, pel[1] + 0.2 * u); ctx.lineTo(pel[0] + 0.7 * u, pel[1] + 0.2 * u);
    ctx.moveTo(pel[0] - 0.55 * u, pel[1] + 0.2 * u); ctx.lineTo(pel[0] - 0.6 * u, stool[1]);
    ctx.moveTo(pel[0] + 0.55 * u, pel[1] + 0.2 * u); ctx.lineTo(pel[0] + 0.6 * u, stool[1]);
    ctx.globalAlpha *= 0.5; ctx.stroke(); ctx.globalAlpha /= 0.5;
    // sound box
    var a = P(-0.3, -0.4), b = P(0.3, -0.4), c = P(0.4, 0.55), d = P(-0.4, 0.55);
    ctx.fillStyle = alpha(colors.accent, 0.2);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // neck and strings
    var top = P(0, -3.05);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, a[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - 0.06 * u, P(0, 0.35)[1]); ctx.lineTo(x - 0.04 * u, P(0, -2.75)[1]);
    ctx.moveTo(x + 0.06 * u, P(0, 0.35)[1]); ctx.lineTo(x + 0.04 * u, P(0, -2.75)[1]);
    ctx.stroke();
    // tuning pegs
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 0.22 * u, P(0, -2.85)[1]); ctx.lineTo(x, P(0, -2.85)[1]);
    ctx.moveTo(x, P(0, -2.68)[1]); ctx.lineTo(x + 0.22 * u, P(0, -2.68)[1]);
    ctx.stroke();
    // horse head: arched neck, muzzle pointing toward the player, one ear
    var h = function (dx, dy) { return P(dx, -3.05 + dy); };
    var q = [h(0, 0), h(0.02, -0.28), h(0.12, -0.42), h(0.3, -0.38), h(0.4, -0.3), h(0.36, -0.22), h(0.18, -0.24), h(0.14, -0.06), h(0.08, 0)];
    ctx.fillStyle = alpha(colors.accent, 0.35);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]);
    for (var i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    var e1 = h(0.08, -0.4), e2 = h(0.06, -0.54), e3 = h(0.14, -0.43);
    ctx.beginPath(); ctx.moveTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.lineTo(e3[0], e3[1]); ctx.stroke();
    // bow: held underhand, drawn horizontally across the strings
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(rh[0] + 0.1 * u, rh[1]); ctx.lineTo(x - 1.0 * u, rh[1] + 0.12 * u); ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(rh[0] + 0.1 * u, rh[1] + 0.08 * u); ctx.quadraticCurveTo((rh[0] + x) / 2 - 0.4 * u, rh[1] + 0.22 * u, x - 1.0 * u, rh[1] + 0.16 * u); ctx.stroke();
  }

  function drawGraph(pts, bones, headIdx, scale) {
    // attention links between the three most-attended joints
    var order = att.map(function (a, i) { return [a, i]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, 3);
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1.2;
    for (var i = 0; i < order.length; i++) {
      for (var k = i + 1; k < order.length; k++) {
        var a = order[i], b = order[k];
        var s = Math.min(a[0], b[0]);
        if (s < 0.3) continue;
        var p = pts[a[1]], q = pts[b[1]];
        var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2 - 0.6 * scale;
        ctx.strokeStyle = alpha(colors.rose, 0.55 * s);
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(mx, my, q[0], q[1]); ctx.stroke();
      }
    }
    ctx.restore();

    ctx.lineCap = "round";
    bones.forEach(function (bn) {
      var p = pts[bn[0]], q = pts[bn[1]];
      var a = (att[bn[0]] + att[bn[1]]) / 2;
      var g = ctx.createLinearGradient(p[0], p[1], q[0], q[1]);
      g.addColorStop(0, alpha(att[bn[0]] > 0.45 ? colors.accent : colors["ink-3"], 0.55 + 0.45 * att[bn[0]]));
      g.addColorStop(1, alpha(att[bn[1]] > 0.45 ? colors.accent : colors["ink-3"], 0.55 + 0.45 * att[bn[1]]));
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1.5, scale * 0.07) * (1 + 0.5 * a);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    });

    if (headIdx != null) {
      var h = pts[headIdx];
      ctx.lineWidth = 2;
      ctx.strokeStyle = alpha(colors["ink-2"], 0.8);
      ctx.beginPath(); ctx.arc(h[0], h[1], 0.42 * scale, 0, Math.PI * 2); ctx.stroke();
    }

    pts.forEach(function (p, i) {
      if (i === headIdx) return;
      var a = att[i];
      if (a > 0.05) {
        var r = (8 + 26 * a) * Math.max(0.6, scale / 60);
        var g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
        g.addColorStop(0, alpha(colors.accent, 0.55 * a));
        g.addColorStop(1, alpha(colors.accent, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = a > 0.45 ? colors.accent : colors.ink;
      ctx.beginPath(); ctx.arc(p[0], p[1], 3 + 3 * a, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = colors.bg; ctx.lineWidth = 1.5; ctx.stroke();
    });
  }

  function drawShadow() {
    var g = ctx.createRadialGradient(cx, cy + 2.95 * u, 0, cx, cy + 2.95 * u, 1.6 * u);
    g.addColorStop(0, alpha(colors.ink, 0.12));
    g.addColorStop(1, alpha(colors.ink, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy + 2.95 * u, 1.6 * u, 0.28 * u, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---- inference panel ---------------------------------------------------
  function panelRows(rows) {
    rowsEl.innerHTML = rows.map(function (r) {
      return '<li><span>' + r[0] + '</span><span class="p">' + r[1].toFixed(2) + '</span><span class="bar"><i style="width:' + (r[1] * 100).toFixed(1) + '%"></i></span></li>';
    }).join("");
  }

  function updatePanelDemo() {
    var tau = clock - actionStart, cur = ACTIONS[actionIdx];
    var top = 0.22 + 0.7 * (1 - Math.exp(-tau * 2.2)) + 0.02 * Math.sin(clock * 3);
    var rest = 1 - top, wsum = 0, w = {};
    ACTIONS.forEach(function (a, i) {
      if (a === cur) return;
      w[a] = 0.4 + noise[i] + (a === prevAction ? 2.5 * Math.exp(-tau * 1.5) : 0) + 0.15 * Math.sin(clock * 2 + i);
      wsum += w[a];
    });
    var rows = [[t("a." + cur), top]];
    for (var a in w) rows.push([t("a." + a), rest * w[a] / wsum]);
    rows.sort(function (x, y) { return y[1] - x[1]; });
    panelRows(rows.slice(0, 3));
  }

  function updatePanelHand(scores) {
    var rows = Object.keys(scores).map(function (k) { return [t("g." + k), scores[k]]; });
    rows.sort(function (x, y) { return y[1] - x[1]; });
    panelRows(rows.slice(0, 3));
  }

  function setModeLabels(live) {
    modeEl.textContent = t(live ? "infer.live" : "infer.demo");
    stage.classList.toggle("live", live);
  }
  var wasLive = false;

  // ---- frame -------------------------------------------------------------
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (running && visible) {
      clock += dt;
      step(dt);
    }
    requestAnimationFrame(frame);
  }

  function step(dt) {
    ctx.clearRect(0, 0, W, H);
    var live = hand && performance.now() - hand.at < 500;
    if (live !== wasLive) { setModeLabels(live); prevPts = null; trails = {}; wasLive = live; }

    var pts, hoverNames;
    if (live) {
      pts = handToScreen(hand.pts);
      var span = handScale;
      updateAttention(pts, dt, span / 6);
      drawGraph(pts, HAND_BONES, null, span / 6);
      hoverNames = HAND_NAMES;
      if (clock - lastPanel > 0.12) { updatePanelHand(hand.scores); lastPanel = clock; }
    } else {
      if (clock - actionStart > ACTION_SECONDS && clock > autoPausedUntil) setAction(actionIdx + 1);
      blend = Math.min(1, blend + dt / 0.8);
      var e = blend < 0.5 ? 2 * blend * blend : 1 - Math.pow(-2 * blend + 2, 2) / 2;
      var cur = ACTIONS[actionIdx];
      var p = mixPose(pose(prevAction, clock), pose(cur, clock), e);
      pts = bodyJoints(p, clock).map(toScreen);
      updateAttention(pts, dt, u);
      drawShadow();
      drawTrails(pts);
      if (e < 1) drawProps(prevAction, pts, 1 - e);
      drawProps(cur, pts, e);
      drawGraph(pts, BODY_BONES, 0, u);
      hoverNames = BODY_NAMES;
      if (clock - lastPanel > 0.12) { updatePanelDemo(); lastPanel = clock; }
    }
    updateTip(pts, hoverNames);
  }

  var handScale = 1;
  function handToScreen(lm) {
    var minX = 1, maxX = 0, minY = 1, maxY = 0;
    lm.forEach(function (p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    var bw = Math.max(maxX - minX, 0.05), bh = Math.max(maxY - minY, 0.05);
    var s = Math.min((W * 0.62) / bw, (H * 0.6) / bh);
    handScale = Math.max(bw, bh) * s;
    var mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
    return lm.map(function (p) { return [W / 2 - (p.x - mx) * s, H * 0.52 + (p.y - my) * s]; });
  }

  function updateTip(pts, names) {
    if (!mouse) { tip.hidden = true; return; }
    var best = -1, bd = 28;
    pts.forEach(function (p, i) { var d = Math.hypot(p[0] - mouse.x, p[1] - mouse.y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.textContent = names[best] + " · att " + att[best].toFixed(2);
    tip.style.left = pts[best][0] + "px";
    tip.style.top = pts[best][1] + "px";
  }

  // ---- events ------------------------------------------------------------
  canvas.addEventListener("pointermove", function (e) {
    var r = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  canvas.addEventListener("pointerleave", function () { mouse = null; tip.hidden = true; });
  canvas.addEventListener("click", function () { if (!wasLive) setAction(actionIdx + 1, true); });

  window.addEventListener("handframe", function (e) { hand = e.detail; hand.at = performance.now(); });
  window.addEventListener("themechange", readColors);
  window.addEventListener("langchange", function () { renderDots(); setModeLabels(wasLive); lastPanel = -1; });
  document.addEventListener("visibilitychange", function () { running = !document.hidden; last = performance.now(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; last = performance.now(); }).observe(stage);
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);

  readColors();
  resize();
  renderDots();
  requestAnimationFrame(frame);
})();
