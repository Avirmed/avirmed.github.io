/* Page logic: i18n, theme, navigation, and rendering of content from data.js. */
(function () {
  "use strict";

  var S = window.SITE;
  var root = document.documentElement;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ME = S.me;
  var ALIASES = { "Thai Duy Quy": "Duy Quy Thai" };
  var canon = function (n) { return ALIASES[n] || n; };

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var ICONS = {
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    email: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    scopus: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5"/><path d="M15.5 8.5c-.8-.9-2-1.5-3.5-1.5-1.9 0-3.3 1-3.3 2.5 0 3.4 7 1.6 7 5 0 1.6-1.6 2.5-3.6 2.5-1.6 0-3-.6-3.8-1.6"/></svg>',
    orcid: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5"/><path d="M8.5 10v7M8.5 7v.01M12 17v-7h2.2a3.5 3.5 0 0 1 0 7z"/></svg>',
    rg: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 17V8h3a2.5 2.5 0 0 1 0 5H8M11 13l3 4M16 9.5c0-1 .8-1.5 1.5-1.5"/></svg>',
    github: '<svg viewBox="0 0 24 24"><path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/></svg>',
    num: '<svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M2 10l10-6 10 6z"/></svg>',
  };

  // ------------------------------------------------------------------ i18n
  function applyI18n() {
    $$("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    $$("[data-i18n-ph]").forEach(function (el) { el.placeholder = t(el.getAttribute("data-i18n-ph")); });
    renderAll();
    window.dispatchEvent(new Event("langchange"));
  }
  $("#lang-toggle").addEventListener("click", function () {
    var l = root.lang === "mn" ? "en" : "mn";
    root.lang = l; store("lang", l); applyI18n();
  });

  // ----------------------------------------------------------------- theme
  $("#theme-toggle").addEventListener("click", function () {
    var th = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", th); store("theme", th);
    $('meta[name="theme-color"]').content = th === "dark" ? "#0c0e12" : "#f5f0e8";
    window.dispatchEvent(new Event("themechange"));
    drawNetwork();
  });

  // ------------------------------------------------------------------- nav
  var nav = $("#nav"), bar = $(".progress span"), menuBtn = $("#menu-btn"), links = $("#nav-links");
  menuBtn.addEventListener("click", function () {
    var open = links.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", function (e) {
    if (e.target.tagName === "A") { links.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
  });

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      nav.classList.toggle("scrolled", y > 20);
      bar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
      // photo parallax
      var ph = $("#photo");
      if (ph && !reduced) {
        var pr = ph.getBoundingClientRect();
        var k = (pr.top + pr.height / 2 - innerHeight / 2) / innerHeight;
        ph.style.setProperty("--py", (-8 + k * 10).toFixed(2) + "%");
      }
    });
  }
  addEventListener("scroll", onScroll, { passive: true });

  var sections = $$("main section[id]");
  var navMap = {};
  $$(".nav-links a").forEach(function (a) { navMap[a.getAttribute("href").slice(1)] = a; });
  var navObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      $$(".nav-links a").forEach(function (a) { a.classList.remove("active"); });
      var a = navMap[en.target.id];
      if (a) a.classList.add("active");
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach(function (s) { navObserver.observe(s); });

  // ---------------------------------------------------------------- reveal
  var revealObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("in"); revealObs.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  function observeReveals() { $$(".reveal:not(.in)").forEach(function (el) { revealObs.observe(el); }); }

  // ----------------------------------------------------------------- toast
  var toastEl = $("#toast"), toastT;
  window.toast = function (msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  };

  // ----------------------------------------------------------------- strata
  (function strata() {
    var svg = $("#strata"), ns = "http://www.w3.org/2000/svg";
    svg.setAttribute("viewBox", "0 0 1200 400");
    var bands = [
      { y: 120, amp: 26, per: 600, col: "--strata-4", dur: 90 },
      { y: 180, amp: 22, per: 400, col: "--strata-1", dur: 70 },
      { y: 235, amp: 30, per: 600, col: "--strata-3", dur: 110 },
      { y: 290, amp: 18, per: 300, col: "--strata-2", dur: 60 },
      { y: 345, amp: 14, per: 400, col: "--strata-5", dur: 80 },
    ];
    bands.forEach(function (b, i) {
      var d = "M0 400 L0 " + b.y;
      for (var x = 0; x <= 2400; x += 20) {
        var y = b.y + Math.sin((x / b.per) * Math.PI * 2 + i) * b.amp + Math.sin((x / (b.per / 2)) * Math.PI * 2 + i * 2) * b.amp * 0.3;
        d += " L" + x + " " + y.toFixed(1);
      }
      d += " L2400 400 Z";
      var p = document.createElementNS(ns, "path");
      p.setAttribute("d", d);
      p.style.fill = "var(" + b.col + ")";
      p.style.animationDuration = b.dur + "s";
      svg.appendChild(p);
    });
  })();

  // ----------------------------------------------------------------- stats
  function renderStats() {
    $("#stats").innerHTML = S.stats.map(function (s) {
      return '<div><dt data-count="' + s.value + '"' + (s.plain ? ' data-plain="1"' : "") + ">" + (s.plain ? s.value : 0) + "</dt><dd>" + esc(pick(s.label)) + "</dd></div>";
    }).join("");
    $$("#stats dt[data-count]").forEach(function (el) {
      if (el.dataset.plain) return;
      var target = +el.dataset.count, t0 = null;
      function tick(ts) {
        if (!t0) t0 = ts;
        var k = Math.min(1, (ts - t0) / 1400);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      }
      setTimeout(function () { requestAnimationFrame(tick); }, 600);
    });
  }

  // -------------------------------------------------------------- research
  function renderNow() {
    var n = S.now;
    $("#now-card").innerHTML =
      '<div class="now-copy"><p class="now-tag"><span class="pulse"></span>' + esc(t("now.tag")) + "</p>" +
      "<h3>" + esc(pick(n.title)) + "</h3><p>" + esc(pick(n.body)) + "</p>" +
      '<dl class="now-stats">' + n.stats.map(function (s) { return "<div><dt>" + esc(s.value) + "</dt><dd>" + esc(pick(s.label)) + "</dd></div>"; }).join("") + "</dl></div>" +
      '<div class="now-glyph" aria-hidden="true"><svg viewBox="0 0 240 124" data-glyph="bev"></svg></div>';
    if (window.Glyphs) Glyphs.mount($("#now-card"));
  }

  function topicCount(k) { return S.publications.filter(function (p) { return p.topics.indexOf(k) >= 0; }).length; }
  function renderResearch() {
    $("#research-grid").innerHTML = S.research.map(function (r, i) {
      return '<article class="rcard reveal" style="--c:var(--t-' + r.topic + ');--d:' + (i * 0.08) + 's" data-tilt>' +
        '<div><p class="tag"><i></i>' + esc(pick(S.topics[r.topic])) + "</p>" +
        "<h3>" + esc(pick(r.title)) + "</h3></div>" +
        '<div class="glyph" aria-hidden="true"><svg viewBox="0 0 120 120" data-glyph="' + r.glyph + '"></svg></div>' +
        "<p>" + esc(pick(r.body)) + "</p>" +
        '<button class="more" type="button" data-topic="' + r.topic + '">' + esc(t("research.see")) + " <b>" + topicCount(r.topic) + "</b>" + ICONS.arrow + "</button>" +
        "</article>";
    }).join("");
    if (window.Glyphs) Glyphs.mount($("#research-grid"));
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".more[data-topic]");
    if (!b) return;
    state.topic = b.dataset.topic; state.author = null;
    renderPubs();
    $("#publications").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  });

  // spotlight + tilt
  document.addEventListener("pointermove", function (e) {
    var c = e.target.closest && e.target.closest("[data-tilt]");
    if (!c) return;
    var r = c.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty("--mx", x * 100 + "%");
    c.style.setProperty("--my", y * 100 + "%");
    if (!reduced && e.pointerType === "mouse") c.style.transform = "perspective(900px) rotateX(" + ((0.5 - y) * 5).toFixed(2) + "deg) rotateY(" + ((x - 0.5) * 6).toFixed(2) + "deg)";
  });
  document.addEventListener("pointerout", function (e) {
    var c = e.target.closest && e.target.closest("[data-tilt]");
    if (c && !c.contains(e.relatedTarget)) c.style.transform = "";
  });

  // ---------------------------------------------------------- publications
  var state = { topic: "all", q: "", author: null };

  function bibtex(p) {
    var first = p.authors[0].split(" ").pop().toLowerCase().replace(/[^a-z]/g, "");
    var word = p.title.split(/\s+/).find(function (w) { return w.length > 3; }).toLowerCase().replace(/[^a-z]/g, "");
    var type = p.type === "journal" ? "article" : "inproceedings";
    var f = [
      "  title     = {" + p.title + "}",
      "  author    = {" + p.authors.join(" and ") + "}",
      "  " + (p.type === "journal" ? "journal  " : "booktitle") + " = {" + p.venue + "}",
      "  year      = {" + p.year + "}",
    ];
    if (p.volume) f.push("  volume    = {" + p.volume + "}");
    if (p.pages) f.push("  pages     = {" + p.pages.replace("–", "--") + "}");
    if (p.doi) f.push("  doi       = {" + p.doi + "}");
    return "@" + type + "{" + first + p.year + word + ",\n" + f.join(",\n") + "\n}";
  }
  window.bibtex = bibtex;

  function authorsHtml(p) {
    var max = 6, list = p.authors.slice(0, max);
    var meIdx = p.authors.indexOf(ME);
    if (meIdx >= max) list[max - 1] = ME;
    var html = list.map(function (a) {
      if (a === ME) return "<strong>" + esc(a) + "</strong>";
      return '<button type="button" data-author="' + esc(canon(a)) + '">' + esc(a) + "</button>";
    }).join(", ");
    if (p.authors.length > max) html += " " + esc(t("pubs.more", { n: p.authors.length - max }));
    return html;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return S.publications.filter(function (p) {
      if (state.topic !== "all" && p.topics.indexOf(state.topic) < 0) return false;
      if (state.author && p.authors.map(canon).indexOf(state.author) < 0) return false;
      if (q && (p.title + " " + p.venue + " " + p.authors.join(" ") + " " + p.year).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function renderChips() {
    var chips = [["all", t("pubs.all"), S.publications.length]].concat(Object.keys(S.topics).map(function (k) { return [k, pick(S.topics[k]), topicCount(k)]; }));
    var html = chips.map(function (c) {
      var style = c[0] === "all" ? "" : ' style="--c:var(--t-' + c[0] + ')"';
      return '<button type="button" class="chip" data-chip="' + c[0] + '" aria-pressed="' + (state.topic === c[0]) + '"' + style + ">" + (c[0] === "all" ? "" : "<i></i>") + esc(c[1]) + " <b>" + c[2] + "</b></button>";
    }).join("");
    if (state.author) html += '<button type="button" class="chip author" data-clear-author>' + esc(t("pubs.with")) + " " + esc(state.author) + " ✕</button>";
    $("#topic-chips").innerHTML = html;
  }

  function renderPubs() {
    renderChips();
    var list = filtered();
    var total = S.publications.length;
    $("#pub-count").textContent = list.length === total ? t("pubs.count", { n: total }) : t("pubs.of", { n: list.length, t: total });
    if (!list.length) { $("#pub-list").innerHTML = '<li class="empty">' + esc(t("pubs.none")) + "</li>"; drawNetwork(); return; }
    $("#pub-list").innerHTML = list.map(function (p, i) {
      var idx = S.publications.indexOf(p);
      var pills = '<span class="pill">' + esc(t("pubs." + p.type)) + "</span>" +
        p.topics.map(function (k) { return '<span class="pill" style="--c:var(--t-' + k + ')"><i></i>' + esc(pick(S.topics[k])) + "</span>"; }).join("") +
        (p.featured ? '<span class="pill star">★ ' + esc(t("pubs.featured")) + "</span>" : "");
      var url = p.doi ? "https://doi.org/" + p.doi : null;
      return '<li class="pub" data-idx="' + idx + '" style="animation-delay:' + Math.min(i * 0.04, 0.4) + 's">' +
        '<span class="yr">' + p.year + "</span><div>" +
        '<div class="meta">' + pills + "</div>" +
        "<h3>" + (url ? '<a href="' + url + '" target="_blank" rel="noopener">' + esc(p.title) + "</a>" : esc(p.title)) + "</h3>" +
        '<p class="au">' + authorsHtml(p) + "</p>" +
        '<p class="ven">' + esc(p.venue) + (p.volume ? ", vol. " + esc(p.volume) : "") + (p.pages ? ", pp. " + esc(p.pages) : "") + "</p>" +
        '<div class="acts">' +
        (url ? '<a class="act" href="' + url + '" target="_blank" rel="noopener">DOI ' + ICONS.ext + "</a>" : "") +
        '<button class="act" type="button" data-bib="' + idx + '">' + ICONS.copy + esc(t("pubs.bib")) + "</button>" +
        "</div></div></li>";
    }).join("");
    drawNetwork();
  }

  $("#topic-chips").addEventListener("click", function (e) {
    var c = e.target.closest("[data-chip]");
    if (c) { state.topic = c.dataset.chip; renderPubs(); return; }
    if (e.target.closest("[data-clear-author]")) { state.author = null; renderPubs(); }
  });
  $("#pub-search").addEventListener("input", function (e) { state.q = e.target.value; renderPubs(); });
  $("#pub-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-bib]");
    if (b) {
      var text = bibtex(S.publications[+b.dataset.bib]);
      var done = function () { toast(t("pubs.copied")); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      else { fallbackCopy(text); done(); }
      return;
    }
    var a = e.target.closest("[data-author]");
    if (a) { state.author = a.dataset.author; renderPubs(); }
  });
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }
  $("#pub-list").addEventListener("pointerover", function (e) {
    var li = e.target.closest(".pub");
    net.hoverPaper = li ? +li.dataset.idx : null;
    drawNetwork();
  });
  $("#pub-list").addEventListener("pointerleave", function () { net.hoverPaper = null; drawNetwork(); });

  // --------------------------------------------------------- co-author net
  var net = { nodes: [], edges: [], hover: null, hoverPaper: null, drag: null, w: 0, h: 0 };
  var nc = $("#network"), nctx = nc.getContext("2d"), ntip = $("#net-tip");

  (function buildNetwork() {
    var map = {};
    S.publications.forEach(function (p, pi) {
      var names = p.authors.map(canon);
      names.forEach(function (n) {
        if (!map[n]) map[n] = { id: n, papers: [], x: null, y: null };
        map[n].papers.push(pi);
      });
      for (var i = 0; i < names.length; i++) {
        for (var j = i + 1; j < names.length; j++) {
          var key = [names[i], names[j]].sort().join("|");
          var e = net.edges.find(function (x) { return x.key === key; });
          if (e) e.w++; else net.edges.push({ key: key, a: names[i], b: names[j], w: 1 });
        }
      }
    });
    net.nodes = Object.keys(map).map(function (k) { return map[k]; });
    net.byId = map;
    // Radial layout: me in the centre; collaborators on a ring, ordered by the
    // paper where we first worked together so co-authors of one paper sit together.
    var others = net.nodes.filter(function (n) { return n.id !== ME; });
    others.sort(function (a, b) { return a.papers[0] - b.papers[0] || b.papers.length - a.papers.length; });
    others.forEach(function (n, i) { n.ang = -Math.PI / 2 + (i / others.length) * Math.PI * 2; });
    net.nodes.forEach(function (n) { n.r = n.id === ME ? 13 : 4 + 2.4 * Math.sqrt(n.papers.length); });
    map[ME].ang = 0;
  })();

  // Start from a ring so the first frame is tidy, then let everything float.
  function layout() {
    var R = Math.min(net.w, net.h) / 2 - 60;
    net.nodes.forEach(function (n, i) {
      if (n.x != null) return;
      var a = n.id === ME ? 2.4 : n.ang;
      var rr = n.id === ME ? R * 0.25 : R * (1 - 0.4 * Math.min(1, (n.papers.length - 1) / 7));
      n.x = Math.cos(a) * rr; n.y = Math.sin(a) * rr;
      n.vx = 0; n.vy = 0; n.ph = i * 2.399;
    });
  }

  function sizeNetwork() {
    var r = nc.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    net.w = r.width; net.h = r.height;
    nc.width = r.width * dpr; nc.height = r.height * dpr;
    nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    drawNetwork();
  }

  // Slow free-floating motion: soft repulsion, weak springs along co-authorship
  // edges, a gentle pull toward the middle and a per-node wander. Nobody is pinned.
  function simulate(dt, time) {
    var N = net.nodes, S2 = Math.min(net.w, net.h), k = dt * 60;
    for (var i = 0; i < N.length; i++) {
      for (var j = i + 1; j < N.length; j++) {
        var a = N[i], b = N[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.max(6, Math.hypot(dx, dy));
        var reach = (a.r + b.r) * 2.2 + 34;
        if (d < reach) {
          var f = (reach - d) * 0.0022 * k;
          a.vx -= dx / d * f; a.vy -= dy / d * f; b.vx += dx / d * f; b.vy += dy / d * f;
        }
      }
    }
    net.edges.forEach(function (e) {
      var a = net.byId[e.a], b = net.byId[e.b];
      var dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
      var rest = (e.a === ME || e.b === ME ? 0.36 : 0.3) * S2;
      var f = (d - rest) * 0.00012 * Math.min(3, e.w) * k;
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
    });
    var limX = net.w / 2 - 26, limY = net.h / 2 - 22, vmax = 0.3 * k;
    N.forEach(function (n) {
      if (net.drag && net.drag.node === n) { n.vx = n.vy = 0; return; }
      n.vx += (-n.x * 0.0005 + Math.cos(time * 0.21 + n.ph) * 0.006) * k;
      n.vy += (-n.y * 0.0005 + Math.sin(time * 0.17 + n.ph * 1.3) * 0.006) * k;
      if (n.x < -limX) n.vx += 0.02 * k; if (n.x > limX) n.vx -= 0.02 * k;
      if (n.y < -limY) n.vy += 0.02 * k; if (n.y > limY) n.vy -= 0.02 * k;
      n.vx *= 0.96; n.vy *= 0.96;
      var sp = Math.hypot(n.vx, n.vy);
      if (sp > vmax) { n.vx *= vmax / sp; n.vy *= vmax / sp; }
      n.x += n.vx; n.y += n.vy;
    });
  }

  function cssVar(n) { return getComputedStyle(root).getPropertyValue(n).trim(); }

  function drawNetwork() {
    if (!net.w) return;
    var c = nctx, W = net.w, H = net.h, ox = W / 2, oy = H / 2;
    var th = root.getAttribute("data-theme");
    if (!net.col || net.col.th !== th) net.col = { th: th, ink: cssVar("--ink"), ink3: cssVar("--ink-3"), line: cssVar("--line-2"), accent: cssVar("--accent"), bg: cssVar("--surface") };
    var ink = net.col.ink, ink3 = net.col.ink3, line = net.col.line, accent = net.col.accent, bg = net.col.bg;
    var visible = {};
    filtered().forEach(function (p) { p.authors.forEach(function (a) { visible[canon(a)] = 1; }); });
    var focus = null;
    if (net.hover) {
      focus = {}; focus[net.hover.id] = 1;
      net.edges.forEach(function (e) { if (e.a === net.hover.id) focus[e.b] = 1; if (e.b === net.hover.id) focus[e.a] = 1; });
    } else if (net.hoverPaper != null) {
      focus = {}; S.publications[net.hoverPaper].authors.forEach(function (a) { focus[canon(a)] = 1; });
    } else if (state.author) {
      focus = {}; focus[state.author] = 1; focus[ME] = 1;
    }

    c.clearRect(0, 0, W, H);
    net.edges.forEach(function (e) {
      var a = net.byId[e.a], b = net.byId[e.b];
      var on = focus ? (focus[e.a] && focus[e.b]) : (visible[e.a] && visible[e.b]);
      var mine = e.a === ME || e.b === ME;
      c.strokeStyle = on && focus ? accent : line;
      c.globalAlpha = on ? (focus ? 0.85 : mine ? 0.6 : 0.14) : 0.08;
      c.lineWidth = Math.min(4, 0.6 + e.w * 0.6);
      c.beginPath(); c.moveTo(ox + a.x, oy + a.y); c.lineTo(ox + b.x, oy + b.y); c.stroke();
    });
    c.globalAlpha = 1;
    net.nodes.forEach(function (n) {
      var on = focus ? focus[n.id] : visible[n.id];
      c.globalAlpha = on ? 1 : 0.25;
      c.beginPath(); c.arc(ox + n.x, oy + n.y, n.r + 2, 0, Math.PI * 2); c.fillStyle = bg; c.fill();
      c.beginPath(); c.arc(ox + n.x, oy + n.y, n.r, 0, Math.PI * 2);
      c.fillStyle = n.id === ME ? accent : (focus && focus[n.id] ? ink : ink3);
      c.fill();
      // selective direct labels: me, frequent collaborators, and whatever is focused
      var label = n.id === ME || n.papers.length >= 3 || (focus && focus[n.id] && n.papers.length >= 1 && (net.hover || net.hoverPaper != null || state.author));
      if (label && on) {
        c.font = (n.id === ME ? "700 12px " : "600 11px ") + "Manrope, sans-serif";
        c.fillStyle = ink;
        var txt = n.id === ME ? (root.lang === "mn" ? "Э. Авирмэд" : "A. Enkhbat") : n.id;
        {
          // anchor the label away from the middle of the canvas
          var al = Math.atan2(n.y, n.x), cx = Math.cos(al), cy = Math.sin(al);
          // anchor outward from the centre, then keep the whole label inside the canvas
          var lx = ox + n.x + cx * (n.r + 7), tw = c.measureText(txt).width;
          var left = cx > 0.35 ? lx : cx < -0.35 ? lx - tw : lx - tw / 2;
          left = Math.max(6, Math.min(W - 6 - tw, left));
          c.textAlign = "left";
          c.textBaseline = "middle";
          c.fillText(txt, left, oy + n.y + cy * (n.r + 9));
          c.textBaseline = "alphabetic";
        }
      }
    });
    c.globalAlpha = 1;
  }

  var netVisible = true, netLast = performance.now(), netTime = 0;
  if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { netVisible = en[0].isIntersecting; }).observe(nc);
  function netLoop(now) {
    var dt = Math.min(0.05, ((now || performance.now()) - netLast) / 1000);
    netLast = now || performance.now();
    if (net.w && netVisible && !document.hidden) { netTime += dt; simulate(dt, netTime); drawNetwork(); }
    requestAnimationFrame(netLoop);
  }

  function nodeAt(x, y) {
    var ox = net.w / 2, oy = net.h / 2, hit = null;
    net.nodes.forEach(function (n) { if (Math.hypot(ox + n.x - x, oy + n.y - y) < n.r + 7) hit = n; });
    return hit;
  }
  function localXY(e) { var r = nc.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  nc.addEventListener("pointerdown", function (e) {
    var p = localXY(e), n = nodeAt(p[0], p[1]);
    if (!n) return;
    net.drag = { node: n, moved: false, sx: p[0], sy: p[1] };
    try { nc.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events from hand mode */ }
    nc.classList.add("dragging");
  });
  nc.addEventListener("pointermove", function (e) {
    var p = localXY(e);
    if (net.drag) {
      if (Math.hypot(p[0] - net.drag.sx, p[1] - net.drag.sy) > 4) net.drag.moved = true;
      if (net.drag.node.id !== ME) { net.drag.node.x = p[0] - net.w / 2; net.drag.node.y = p[1] - net.h / 2; }
    }
    var n = net.drag ? net.drag.node : nodeAt(p[0], p[1]);
    if (n !== net.hover) { net.hover = n; drawNetwork(); }
    if (n) {
      ntip.hidden = false;
      var joint = n.id === ME ? n.papers.length : net.edges.filter(function (x) { return (x.a === ME && x.b === n.id) || (x.b === ME && x.a === n.id); }).reduce(function (s, x) { return s + x.w; }, 0);
      ntip.innerHTML = "<b>" + esc(n.id) + "</b><span>" + esc(n.id === ME ? t("pubs.count", { n: joint }) : t("net.papers", { n: joint })) + "</span>";
      ntip.style.left = net.w / 2 + n.x + "px";
      ntip.style.top = net.h / 2 + n.y - n.r + "px";
      nc.style.cursor = "pointer";
    } else { ntip.hidden = true; nc.style.cursor = ""; }
  });
  nc.addEventListener("pointerup", function () {
    if (net.drag && !net.drag.moved) {
      var id = net.drag.node.id;
      state.author = id === ME || state.author === id ? null : id;
      renderPubs();
    }
    net.drag = null;
    nc.classList.remove("dragging");
  });
  nc.addEventListener("pointerleave", function () { if (!net.drag) { net.hover = null; ntip.hidden = true; drawNetwork(); } });

  // --------------------------------------------------------------- courses
  function renderCourses() {
    $("#course-grid").innerHTML = S.courses.map(function (c, i) {
      return '<article class="course reveal" data-tilt style="--d:' + i * 0.07 + 's">' +
        '<span class="code">' + esc(c.code) + "</span>" +
        '<span class="big" aria-hidden="true">' + esc(c.code.slice(-3)) + "</span>" +
        "<h3>" + esc(pick(c.title)) + "</h3>" +
        '<p class="terms">' + esc(pick(c.terms)) + "</p>" +
        '<div class="cr">' + esc(t("teach.credits", { n: c.credits })) + "</div></article>";
    }).join("");
  }

  // ----------------------------------------------------------------- links
  function renderLinks() {
    $("#links").innerHTML = S.links.map(function (l) {
      var label = pick(l.label);
      var host = l.key === "email" ? "Email" : l.href.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
      var ext = l.href.indexOf("mailto:") === 0 ? "" : ' target="_blank" rel="noopener"';
      return '<a class="link" href="' + esc(l.href) + '"' + ext + '><span class="ic">' + ICONS[l.key] + "</span><span>" + esc(label) + "<small>" + esc(host) + "</small></span>" +
        '<svg class="arr" viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg></a>';
    }).join("");
  }

  // ------------------------------------------------------------------ boot
  var booted = false;
  function renderAll() {
    renderStats();
    renderNow();
    renderResearch();
    renderPubs();
    renderCourses();
    renderLinks();
    // re-rendered nodes that were already on screen should not animate in again
    if (booted) $$(".reveal").forEach(function (el) { el.classList.add("in"); });
    observeReveals();
    booted = true;
  }

  $("#year").textContent = new Date().getFullYear();
  applyI18n();
  onScroll();
  if ("ResizeObserver" in window) new ResizeObserver(sizeNetwork).observe(nc); else { addEventListener("resize", sizeNetwork); sizeNetwork(); }
  requestAnimationFrame(netLoop);
})();
