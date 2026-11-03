/*
 * Code section: an editor that types out a real STA-GCN block, runs it in a
 * (simulated) terminal, then hands the terminal over to the visitor.
 */
(function () {
  "use strict";

  var ide = document.getElementById("ide");
  if (!ide) return;
  var codeEl = document.getElementById("ide-code");
  var srcEl = document.getElementById("ide-src");
  var gutter = document.getElementById("ide-gutter");
  var tabsEl = document.getElementById("ide-tabs");
  var runBtn = document.getElementById("ide-run");
  var posEl = document.getElementById("ide-pos");
  var langEl = document.getElementById("ide-lang");
  var out = document.getElementById("term-out");
  var input = document.getElementById("term-in");
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var FILES = [
    {
      name: "gesture.py", lang: "py", label: "Python 3.11", live: true,
      text: [
        "import cv2",
        "import mediapipe as mp",
        "import numpy as np",
        "",
        "TIPS, PIPS = [8, 12, 16, 20], [6, 10, 14, 18]   # index … pinky",
        "",
        "",
        "def fingers_up(lm):",
        '    """A finger is open when its tip is farther from the wrist than its PIP."""',
        "    d = np.linalg.norm(lm - lm[0], axis=1)",
        "    return [bool(d[t] > d[p]) for t, p in zip(TIPS, PIPS)]",
        "",
        "",
        "def gesture(lm):",
        "    palm = np.linalg.norm(lm[9] - lm[0])",
        "    if np.linalg.norm(lm[4] - lm[8]) / palm < 0.32:",
        '        return "pinch"',
        "    up = fingers_up(lm)",
        "    if not any(up):",
        "        thumb_up = lm[4][1] < lm[3][1] < lm[2][1] < lm[5][1]   # y grows downward",
        '        return "like" if thumb_up else "fist"',
        "    if up == [True, False, False, False]:",
        '        return "point"',
        "    if up == [False, True, False, False]:",
        '        return "..."                                     # 😅',
        "    if up == [True, True, False, False]:",
        '        return "victory"',
        '    return "open" if all(up) else "hand"',
        "",
        "",
        "cap = cv2.VideoCapture(0)",
        "with mp.solutions.hands.Hands(max_num_hands=1) as hands:",
        "    frame = 0",
        "    while cap.isOpened():",
        "        ok, img = cap.read()",
        "        if not ok:",
        "            break",
        "        res = hands.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))",
        "        if res.multi_hand_landmarks:",
        "            pts = res.multi_hand_landmarks[0].landmark",
        "            lm = np.array([[p.x, p.y] for p in pts])   # 21 × (x, y)",
        "            g, (x, y) = gesture(lm), lm[8]",
        '            print(f"frame {frame:05d}  gesture={g:<8} tip=({x:.2f}, {y:.2f})")',
        "        frame += 1",
      ].join("\n"),
      cmd: "python gesture.py",
    },
    {
      name: "hand_landmarker.js", lang: "js", label: "JavaScript", live: true,
      text: [
        'import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";',
        "",
        "// The model behind this page's hand mode — it runs entirely in the browser.",
        "const vision = await FilesetResolver.forVisionTasks(WASM_URL);",
        "const hands = await HandLandmarker.createFromOptions(vision, {",
        '  baseOptions: { modelAssetPath: "hand_landmarker.task", delegate: "GPU" },',
        '  runningMode: "VIDEO",',
        "  numHands: 1,",
        "});",
        "",
        "function loop() {",
        "  const res = hands.detectForVideo(video, performance.now());",
        "  const lm = res.landmarks[0];                  // 21 points in [0, 1]",
        "  if (lm) {",
        "    // the index knuckle stays still while pinching, unlike the fingertip",
        "    cursor = smooth(cursor, toScreen(1 - lm[5].x, lm[5].y));",
        "    const pinched = dist(lm[4], lm[8]) / dist(lm[0], lm[9]) < 0.32;",
        "    const act = pinchStep(pinched, cursor.y);",
        '    if (act === "click") click(cursor);           // two quick pinches',
        '    if (act === "scroll") scrollBy(0, (lastY - cursor.y) * 1.5);  // hold + move',
        "    lastY = cursor.y;",
        "  }",
        "  requestAnimationFrame(loop);",
        "}",
        "requestAnimationFrame(loop);",
      ].join("\n"),
      cmd: "node hand_landmarker.js",
    },
    {
      name: "sta_gcn.py", lang: "py", label: "Python 3.11",
      text: [
        "import torch",
        "import torch.nn as nn",
        "",
        "",
        "class STAttention(nn.Module):",
        '    """Spatial-temporal attention over skeleton joints."""',
        "",
        "    def __init__(self, channels):",
        "        super().__init__()",
        "        self.spatial = nn.Conv1d(channels, 1, kernel_size=1)",
        "        self.temporal = nn.Conv1d(channels, 1, kernel_size=9, padding=4)",
        "",
        "    def forward(self, x):                            # x: (N, C, T, V)",
        "        s = torch.sigmoid(self.spatial(x.mean(2)))   # (N, 1, V)",
        "        t = torch.sigmoid(self.temporal(x.mean(3)))  # (N, 1, T)",
        "        return x * s.unsqueeze(2) * t.unsqueeze(3)",
        "",
        "",
        "class GCNBlock(nn.Module):",
        "    def __init__(self, c_in, c_out, A):",
        "        super().__init__()",
        '        self.register_buffer("A", A)                 # (K, V, V) partitions',
        "        self.conv = nn.Conv2d(c_in, c_out * A.size(0), 1)",
        "        self.tcn = nn.Sequential(",
        "            nn.BatchNorm2d(c_out), nn.ReLU(),",
        "            nn.Conv2d(c_out, c_out, (9, 1), padding=(4, 0)),",
        "            nn.BatchNorm2d(c_out),",
        "        )",
        "        self.att = STAttention(c_out)",
        "",
        "    def forward(self, x):",
        "        n, _, t, v = x.shape",
        "        x = self.conv(x).view(n, self.A.size(0), -1, t, v)",
        '        x = torch.einsum("nkctv,kvw->nctw", x, self.A)',
        "        return torch.relu(self.att(self.tcn(x)))",
        "",
        "",
        'if __name__ == "__main__":',
        "    A = torch.rand(3, 25, 25)            # 3 partitions, 25 joints",
        "    x = torch.randn(8, 3, 64, 25)        # batch, xyz, frames, joints",
        "    y = GCNBlock(3, 64, A)(x)",
        '    print("input  :", tuple(x.shape))',
        '    print("output :", tuple(y.shape))',
      ].join("\n"),
      cmd: "python sta_gcn.py",
      output: [["dim", "loading torch…"], ["", "input  : (8, 3, 64, 25)"], ["", "output : (8, 64, 64, 25)"]],
    },
  ];

  // ---------------------------------------------------------------- highlight
  var KW = {
    py: /^(import|from|as|class|def|return|if|else|elif|for|in|while|with|not|and|or|None|True|False|lambda|super|print|tuple)$/,
    js: /^(const|let|var|function|return|if|else|for|while|new|true|false|null|of|in)$/,
  };
  function tokenize(text, lang) {
    var re = lang === "py"
      ? /("""[\s\S]*?"""|"[^"\n]*"|'[^'\n]*'|#[^\n]*|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*|\s+|.)/g
      : /(\/\/[^\n]*|"[^"\n]*"|'[^'\n]*'|`[^`]*`|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*|\s+|.)/g;
    var toks = [], m;
    while ((m = re.exec(text))) {
      var s = m[0], cls = "";
      if (/^("""|"|'|`)/.test(s)) cls = s.indexOf('"""') === 0 ? "c" : "s";
      else if (/^(#|\/\/)/.test(s)) cls = "c";
      else if (/^\d/.test(s)) cls = "n";
      else if (/^[A-Za-z_]/.test(s)) {
        var rest = text.slice(re.lastIndex);
        if (s === "self" || s === "this") cls = "d";
        else if (KW[lang].test(s)) cls = "k";
        else if (/^[A-Z]/.test(s) && !/^[A-Z_\d]+$/.test(s)) cls = "cl";
        else if (/^\s*\(/.test(rest)) cls = "f";
      }
      toks.push([s, cls]);
    }
    return toks;
  }
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function render(toks, n, caret) {
    var html = "", left = n;
    for (var i = 0; i < toks.length && left > 0; i++) {
      var s = toks[i][0].length > left ? toks[i][0].slice(0, left) : toks[i][0];
      left -= s.length;
      html += toks[i][1] ? '<span class="tk-' + toks[i][1] + '">' + esc(s) + "</span>" : esc(s);
    }
    return html + (caret ? '<span class="caret"></span>' : "");
  }

  // ------------------------------------------------------------------- editor
  var cur = 0, typed = FILES.map(function () { return false; }), typing = null, toksCache = {};
  function toks(i) { return toksCache[i] || (toksCache[i] = tokenize(FILES[i].text, FILES[i].lang)); }

  function renderTabs() {
    tabsEl.innerHTML = FILES.map(function (f, i) {
      return '<button class="tab ' + f.lang + '" role="tab" type="button" aria-selected="' + (i === cur) + '" data-i="' + i + '"><i></i>' + f.name + "</button>";
    }).join("");
  }
  tabsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".tab");
    if (!b) return;
    show(+b.dataset.i);
  });

  function setGutter(text) {
    var n = text.split("\n").length, s = "";
    for (var i = 1; i <= n; i++) s += i + "\n";
    gutter.textContent = s;
  }
  function setPos(text, n) {
    var before = text.slice(0, n).split("\n");
    posEl.textContent = "Ln " + before.length + ", Col " + (before[before.length - 1].length + 1);
  }

  // The editor body scrolls; while typing it follows the caret unless the
  // visitor scrolls it themselves.
  var body = ide.querySelector(".ide-body"), follow = true;
  ["wheel", "touchmove"].forEach(function (ev) { body.addEventListener(ev, function () { if (typing) follow = false; }, { passive: true }); });
  function followCaret() {
    var c = codeEl.querySelector(".caret");
    if (!c || !follow) return;
    var target = c.offsetTop - body.clientHeight * 0.6;
    if (target > body.scrollTop) body.scrollTop += Math.min(target - body.scrollTop, 24);
  }
  function updateFades() {
    var max = body.scrollHeight - body.clientHeight;
    ide.classList.toggle("fade-top", body.scrollTop > 4);
    ide.classList.toggle("fade-bottom", body.scrollTop < max - 4);
  }
  body.addEventListener("scroll", updateFades, { passive: true });

  function show(i) {
    stopTyping();
    body.scrollTop = 0;
    follow = true;
    cur = i;
    renderTabs();
    var f = FILES[i];
    langEl.textContent = f.label;
    setGutter(f.text);
    if (typed[i]) { finish(i, false); return; }
    type(i);
  }

  var hinted = false;
  function finish(i, justTyped) {
    var f = FILES[i];
    typed[i] = true;
    codeEl.innerHTML = render(toks(i), f.text.length, false);
    setPos(f.text, f.text.length);
    updateFades();
    if (justTyped && f.live && !hinted) { hinted = true; print("# ▶ Run — " + f.name + " with your own camera", "hl"); }
  }

  function type(i) {
    var f = FILES[i], n = 0, last = performance.now(), wait = 0;
    function step(now) {
      var dt = now - last; last = now;
      if (wait > 0) { wait -= dt; typing = requestAnimationFrame(step); return; }
      var add = Math.max(1, Math.round(dt / 1000 * 320));
      for (var k = 0; k < add && n < f.text.length; k++) {
        n++;
        while (n < f.text.length && f.text[n - 1] === " " && f.text[n] === " ") n++; // indentation lands at once
        if (f.text[n - 1] === "\n") { wait = 20 + Math.random() * 50; break; }
      }
      codeEl.innerHTML = render(toks(i), n, true);
      setPos(f.text, n);
      followCaret();
      updateFades();
      if (n >= f.text.length) { typing = null; finish(i, true); return; }
      typing = requestAnimationFrame(step);
    }
    typing = requestAnimationFrame(step);
  }
  function stopTyping() { if (typing) cancelAnimationFrame(typing); typing = null; }
  srcEl.addEventListener("click", function () { if (typing) { stopTyping(); finish(cur, true); } });

  // ----------------------------------------------------------------- terminal
  var busy = false, history = [], hIdx = 0;

  function print(text, cls) {
    var d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = text;
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
    return d;
  }
  function printCmd(cmd) {
    var d = document.createElement("div");
    d.className = "cmd";
    d.innerHTML = "<b>$</b> " + esc(cmd);
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
  }

  // Live files stream real detections from the in-page MediaPipe model.
  var streaming = false, frameNo = 0, lastLine = 0, handOn = false;
  function runLive(f) {
    printCmd(f.cmd);
    streaming = true;
    if (handOn) { print("camera already open — streaming landmarks", "dim"); return; }
    print("opening camera… allow access to continue (Ctrl+C to stop)", "dim");
    var b = document.querySelector("[data-hand-toggle]");
    if (b) b.click();
  }
  addEventListener("handmode", function (e) {
    handOn = e.detail.on;
    if (!handOn && streaming) { print("^C", "dim"); print("camera released", "ok"); streaming = false; }
  });
  addEventListener("handframe", function (e) {
    if (!streaming) return;
    frameNo++;
    var now = performance.now();
    if (now - lastLine < 140) return;
    lastLine = now;
    var sc = e.detail.scores, g = Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a]; })[0];
    var tip = e.detail.pts[8];
    var line = "frame " + String(frameNo).padStart(5, "0") + "  gesture=" + ((g === "middle" ? "...😅" : g) + "        ").slice(0, 8) + " tip=(" + tip.x.toFixed(2) + ", " + tip.y.toFixed(2) + ")";
    print(line, g === "pinch" ? "hl" : "");
    while (out.childElementCount > 250) out.removeChild(out.firstChild);
  });

  function run() {
    if (busy) return;
    var f = FILES[cur];
    if (f.live) { runLive(f); return; }
    busy = true; runBtn.classList.add("busy");
    printCmd(f.cmd);
    var delay = 450;
    f.output.forEach(function (line, i) {
      setTimeout(function () {
        if (line[0] === "dim" && i === 0 && f.output.length > 1) {
          var d = print(line[1], "dim");
          setTimeout(function () { d.remove(); }, 500);
        } else print(line[1], line[0]);
      }, delay * (i + 1) + (i > 0 ? 500 : 0));
    });
    setTimeout(function () {
      busy = false; runBtn.classList.remove("busy");
    }, delay * (f.output.length + 1) + 500);
  }
  runBtn.addEventListener("click", function () {
    if (!typed[cur]) { stopTyping(); finish(cur, false); }
    run();
  });

  var LINKS = {
    scopus: "https://www.scopus.com/authid/detail.uri?authorId=57221787377",
    orcid: "https://orcid.org/0000-0002-9552-4784",
    github: "https://github.com/Avirmed",
    researchgate: "https://www.researchgate.net/profile/Avirmed-Enkhbat",
  };
  var SECTIONS = ["about", "research", "publications", "code", "teaching", "contact"];

  var COMMANDS = {
    help: function () {
      print([
        "whoami            who is this",
        "ls                list files",
        "cat <file>        print a file (about.md, publications.bib)",
        "cd <section>      jump to " + SECTIONS.join(", "),
        "run               run the open file (gesture.py uses your camera)",
        "stop | Ctrl+C     stop streaming",
        "scopus | orcid | github | researchgate",
        "email             write to me",
        "hand              control the page with your hand",
        "theme | lang      switch theme / language",
        "clear",
      ].join("\n"), "dim");
    },
    whoami: function () { print("avirmed · associate professor @ NUM · ph.d. NCU 2024 · skeletons, hands, gestures"); },
    ls: function () { print("about.md  publications.bib  " + FILES.map(function (f) { return f.name; }).join("  ") + "  teaching/  contact"); },
    cat: function (a) {
      if (a === "about.md") print(t("about.p1") + "\n\n" + t("about.p2"));
      else if (a === "publications.bib") print(window.SITE.publications.map(window.bibtex).join("\n\n"), "hl");
      else if (fileIdx(a) >= 0) print(FILES[fileIdx(a)].text);
      else print("cat: " + (a || "") + ": No such file", "err");
    },
    cd: function (a) {
      a = (a || "").replace(/^[./~]+|\/$/g, "");
      if (a === "pubs") a = "publications";
      if (SECTIONS.indexOf(a) < 0) { print("cd: " + a + ": No such section", "err"); return; }
      document.getElementById(a).scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    },
    run: function () { run(); },
    python: function (a) { runFile(a, "py", "python: can't open file '" + (a || "") + "'"); },
    node: function (a) { runFile(a, "js", "node: cannot find '" + (a || "") + "'"); },
    stop: function () { stopStream(); },
    email: function () { location.href = "mailto:avirmed.e@num.edu.mn"; },
    hand: function () { var b = document.querySelector("[data-hand-toggle]"); if (b) b.click(); },
    theme: function () { document.getElementById("theme-toggle").click(); print("theme → " + document.documentElement.getAttribute("data-theme"), "ok"); },
    lang: function () { document.getElementById("lang-toggle").click(); print("lang → " + document.documentElement.lang, "ok"); },
    date: function () { print(new Date().toString()); },
    echo: function (a, rest) { print(rest); },
    history: function () { print(history.map(function (h, i) { return String(i + 1).padStart(4) + "  " + h; }).join("\n")); },
    clear: function () { out.innerHTML = ""; },
    sudo: function () { print("avirmed is not in the sudoers file. This incident will be reported.", "err"); },
  };
  Object.keys(LINKS).forEach(function (k) {
    COMMANDS[k] = function () { window.open(LINKS[k], "_blank", "noopener"); print("opening " + LINKS[k], "ok"); };
  });
  COMMANDS.open = COMMANDS.cd;

  function fileIdx(name) { for (var i = 0; i < FILES.length; i++) if (FILES[i].name === name) return i; return -1; }
  function runFile(name, lang, err) {
    var i = fileIdx(name);
    if (i < 0 || FILES[i].lang !== lang) { print(err, "err"); return; }
    if (cur !== i) show(i);
    if (!typed[i]) { stopTyping(); finish(i, false); }
    run();
  }
  function stopStream() {
    if (!streaming) return;
    if (handOn) document.getElementById("hand-close").click();
    else { print("^C", "dim"); streaming = false; }
  }

  function exec(line) {
    var raw = line.trim();
    if (!raw) return;
    printCmd(raw);
    history.push(raw); hIdx = history.length;
    var parts = raw.split(/\s+/), cmd = parts[0].toLowerCase(), arg = parts[1], rest = raw.slice(parts[0].length).trim();
    if (COMMANDS[cmd]) COMMANDS[cmd](arg, rest);
    else print(cmd + ": command not found — try `help`", "err");
  }

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { exec(input.value); input.value = ""; }
    else if (e.key === "c" && e.ctrlKey && input.selectionStart === input.selectionEnd && streaming) { stopStream(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { if (hIdx > 0) input.value = history[--hIdx]; e.preventDefault(); }
    else if (e.key === "ArrowDown") { hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ""; e.preventDefault(); }
    else if (e.key === "Tab") {
      var v = input.value, all = Object.keys(COMMANDS).concat(SECTIONS.map(function (s) { return "cd " + s; }), ["cat about.md", "cat publications.bib"], FILES.map(function (f) { return (f.lang === "py" ? "python " : "node ") + f.name; }));
      var hit = all.filter(function (c) { return c.indexOf(v) === 0; });
      if (v && hit.length === 1) { input.value = hit[0] + " "; }
      e.preventDefault();
    }
    e.stopPropagation();
  });
  document.getElementById("term").addEventListener("click", function (e) { if (!e.target.closest("a")) input.focus({ preventScroll: true }); });

  // --------------------------------------------------------------------- boot
  renderTabs();
  setGutter(FILES[0].text);
  print("# type `help` and press Enter", "dim");
  codeEl.innerHTML = '<span class="caret"></span>';
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { io.disconnect(); show(0); }
    }, { threshold: 0.35 });
    io.observe(ide);
  } else show(0);
})();
