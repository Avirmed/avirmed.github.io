/*
 * Hand mode: MediaPipe HandLandmarker runs in the browser.
 * - The index-finger knuckle (MCP) drives a smoothed cursor; unlike the
 *   fingertip it stays still while the fingers pinch.
 * - Two quick thumb–index pinches click.
 * - Pinch and hold, then move the hand: up scrolls the page down, down scrolls
 *   it up; releasing lets it glide to a stop.
 * Each frame is also broadcast as a "handframe" event so the hero stage can
 * draw the visitor's hand as a graph.
 */
const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const $ = (s) => document.querySelector(s);
const root = document.documentElement;
const modal = $("#hand-modal");
const statusEl = $("#hm-status");
const pip = $("#hand-pip");
const video = $("#hand-video");
const overlay = $("#hand-overlay");
const octx = overlay.getContext("2d");
const cursor = $("#hand-cursor");
const gestureEl = $("#pip-gesture");

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const PINCH_DOWN = 0.32;    // thumb–index distance / palm size
const PINCH_UP = 0.46;
const HOLD_MS = 280;        // a pinch held this long starts scrolling
const TAP_MAX_MS = 260;     // a pinch released sooner than this is a tap
const DOUBLE_MS = 500;      // two taps within this window click
const SCROLL_GAIN = 1.5;    // page pixels per pixel of hand travel
const GLIDE = 0.9;          // momentum kept per frame after a scroll

let landmarker = null;
let stream = null;
let running = false;
let lastVideoTime = -1;
let pos = null;             // smoothed cursor, px
let lastFrameT = 0;
let lastSeen = 0;
let hovered = null;
let lastTrigger = null;
let pinch = { down: false, since: 0, lastY: 0, vel: 0, scrolling: false, lastTap: 0 };
let glide = 0;
let flashUntil = 0;

// ------------------------------------------------------------------ UI wiring
document.querySelectorAll("[data-hand-toggle]").forEach((b) =>
  b.addEventListener("click", () => (running ? stop() : openModal()))
);
$("#hm-cancel").addEventListener("click", closeModal);
$("#hm-start").addEventListener("click", start);
$("#hand-close").addEventListener("click", stop);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!modal.hidden) closeModal();
  else if (running) stop();
});

function openModal() {
  lastTrigger = document.activeElement;
  statusEl.textContent = "";
  modal.hidden = false;
  $("#hm-start").focus();
}
function closeModal() {
  modal.hidden = true;
  if (lastTrigger) lastTrigger.focus();
}

// ------------------------------------------------------------------ lifecycle
async function start() {
  const btn = $("#hm-start");
  btn.disabled = true;
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("camera API unavailable (needs https)");
    statusEl.textContent = t("hm.camera");
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
    video.srcObject = stream;
    await video.play();

    if (!landmarker) {
      statusEl.textContent = t("hm.loading");
      const { FilesetResolver, HandLandmarker } = await import(VISION + "/vision_bundle.mjs");
      const fileset = await FilesetResolver.forVisionTasks(VISION + "/wasm");
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
      try { landmarker = await HandLandmarker.createFromOptions(fileset, opts("GPU")); }
      catch (e) { landmarker = await HandLandmarker.createFromOptions(fileset, opts("CPU")); }
    }

    modal.hidden = true;
    pip.hidden = false;
    cursor.hidden = false;
    root.classList.add("hand-on");
    running = true;
    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
    toast(t("hm.on"));
    dispatchEvent(new CustomEvent("handmode", { detail: { on: true } }));
    requestAnimationFrame(loop);
  } catch (err) {
    statusEl.textContent = t("hm.error") + (err && err.message ? err.message : err);
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    stream = null;
  } finally {
    btn.disabled = false;
  }
}

function stop() {
  running = false;
  if (stream) stream.getTracks().forEach((tr) => tr.stop());
  stream = null;
  video.srcObject = null;
  pip.hidden = true;
  cursor.hidden = true;
  root.classList.remove("hand-on");
  setHover(null);
  releasePinch();
  glide = 0;
  pos = null;
  toast(t("hm.off"));
  dispatchEvent(new CustomEvent("handmode", { detail: { on: false } }));
}

// ------------------------------------------------------------------ per frame
function loop() {
  if (!running) return;
  try {
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const res = landmarker.detectForVideo(video, performance.now());
      let lm = res.landmarks && res.landmarks[0];
      // the tracker can hold a "ghost" hand at the border after it has left the frame
      if (lm && outOfFrame(lm[9])) lm = null;
      drawOverlay(lm);
      if (lm) onHand(lm);
      else onNoHand();
    }
    if (glide) {
      scrollBy({ top: glide, behavior: "instant" });
      glide = Math.abs(glide) < 0.4 ? 0 : glide * GLIDE;
    }
  } catch (err) {
    console.warn("hand mode frame skipped:", err);
  } finally {
    requestAnimationFrame(loop);   // one bad frame must never stop tracking
  }
}

const outOfFrame = (p) => p.x < -0.02 || p.x > 1.02 || p.y < -0.02 || p.y > 1.02;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function extension(lm, tip, pip) {
  // >0 when the fingertip is farther from the wrist than its PIP joint
  return clamp((dist(lm[0], lm[tip]) / Math.max(dist(lm[0], lm[pip]), 1e-4) - 1) / 0.6, 0, 1);
}

function gestures(lm) {
  const palm = Math.max(dist(lm[0], lm[9]), 1e-4);
  const e = {
    thumb: clamp((dist(lm[4], lm[17]) / Math.max(dist(lm[3], lm[17]), 1e-4) - 1) / 0.4, 0, 1),
    index: extension(lm, 8, 6),
    middle: extension(lm, 12, 10),
    ring: extension(lm, 16, 14),
    pinky: extension(lm, 20, 18),
  };
  // In a fist the thumb rests on the curled index finger, which would read as a
  // pinch; a real pinch keeps the index fingertip out beyond its PIP joint.
  const indexOut = dist(lm[0], lm[8]) > dist(lm[0], lm[6]) * 0.95;
  const pinchRatio = indexOut ? dist(lm[4], lm[8]) / palm : Infinity;
  const curled = (1 - e.index) * (1 - e.middle) * (1 - e.ring) * (1 - e.pinky);
  // thumbs-up: thumb tip clearly above its own joints and the index knuckle
  const thumbUp = lm[4].y < lm[3].y && lm[3].y < lm[2].y ? clamp(((lm[5].y - lm[4].y) / palm - 0.25) / 0.5, 0, 1) : 0;
  const raw = {
    point: e.index * (1 - e.middle) * (1 - e.ring) * (1 - e.pinky),
    victory: e.index * e.middle * (1 - e.ring) * (1 - e.pinky),
    middle: e.middle * (1 - e.index) * (1 - e.ring) * (1 - e.pinky),
    open: Math.pow((e.thumb + e.index + e.middle + e.ring + e.pinky) / 5, 2),
    like: curled * thumbUp,
    fist: curled * (1 - thumbUp),
    pinch: clamp((0.5 - pinchRatio) / 0.3, 0, 1),
  };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0) + 0.05;
  const scores = {};
  for (const k in raw) scores[k] = raw[k] / sum;
  return { pinchRatio, scores };
}

// Map the index knuckle to the screen: the central 0.3–0.8 of the camera frame
// covers the whole viewport, so small hand movements reach every corner.
function knuckleToScreen(p) {
  return {
    x: clamp((1 - p.x - 0.3) * 2, 0, 1) * innerWidth,
    y: clamp((p.y - 0.3) * 2, 0, 1) * innerHeight,
  };
}

// Exponential moving average that follows faster when the hand moves faster:
// a resting hand is held steady, a quick move is not left lagging behind.
function smooth(prev, target, dt) {
  if (!prev) return { ...target };
  const speed = Math.hypot(target.x - prev.x, target.y - prev.y) / Math.max(dt, 1e-3);
  const a30 = 0.12 + Math.min(0.45, speed / 4000);         // per frame at 30 fps
  const a = 1 - Math.pow(1 - a30, dt * 30);
  return { x: prev.x + (target.x - prev.x) * a, y: prev.y + (target.y - prev.y) * a };
}

// Pinch input as a small state machine. Returns the new state and what happened.
function pinchStep(s, isDown, y, now) {
  if (isDown && !s.down) {
    return { s: { ...s, down: true, since: now, lastY: y, vel: 0, scrolling: false }, act: "press" };
  }
  if (isDown && s.down) {
    if (!s.scrolling) {
      if (now - s.since < HOLD_MS) return { s, act: null };
      return { s: { ...s, scrolling: true, lastY: y, vel: 0 }, act: "scroll-start" };
    }
    const dy = (s.lastY - y) * SCROLL_GAIN;                  // hand up -> page down
    return { s: { ...s, lastY: y, vel: s.vel * 0.6 + dy * 0.4 }, act: "scroll", amount: dy };
  }
  if (!isDown && s.down) {
    const up = { ...s, down: false, scrolling: false };
    if (s.scrolling) return { s: { ...up, lastTap: 0 }, act: "scroll-end", amount: s.vel };
    if (now - s.since > TAP_MAX_MS) return { s: { ...up, lastTap: 0 }, act: null };
    if (s.lastTap && now - s.lastTap <= DOUBLE_MS) return { s: { ...up, lastTap: 0 }, act: "click" };
    return { s: { ...up, lastTap: now }, act: "tap" };
  }
  return { s, act: null };
}

function onHand(lm) {
  const now = performance.now();
  const dt = Math.min(0.1, (now - (lastFrameT || now)) / 1000) || 1 / 30;
  lastFrameT = now;
  lastSeen = now;
  cursor.classList.remove("lost");

  pos = smooth(pos, knuckleToScreen(lm[5]), dt);
  cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

  const g = gestures(lm);
  dispatchEvent(new CustomEvent("handframe", { detail: { pts: lm.map((p) => ({ x: p.x, y: p.y })), scores: g.scores } }));

  // pinch with hysteresis
  const isDown = pinch.down ? g.pinchRatio < PINCH_UP : g.pinchRatio < PINCH_DOWN;
  const r = pinchStep(pinch, isDown, pos.y, now);
  pinch = r.s;
  if (r.act === "press") { glide = 0; cursor.classList.add("pinch"); }
  if (r.act === "scroll-start") cursor.classList.add("scroll");
  if (r.act === "scroll") scrollBy({ top: r.amount, behavior: "instant" });
  if (r.act === "scroll-end") glide = r.amount;
  if (r.act === "tap") flash("tap", t("g.pinch") + " ×1", now);
  if (r.act === "click") { flash("click", "Click", now); click(pos.x, pos.y); }
  if (!pinch.down) cursor.classList.remove("pinch", "scroll");

  if (pinch.scrolling) gestureEl.textContent = "Scroll ↕";
  else if (now > flashUntil) {
    const top = Object.entries(g.scores).sort((a, b) => b[1] - a[1])[0][0];
    gestureEl.textContent = t("g." + top);
  }

  // hover target
  const el = document.elementFromPoint(pos.x, pos.y);
  setHover(el ? el.closest("a, button, input, [data-tilt], .pub") : null);
}

function flash(cls, label, now) {
  cursor.classList.remove("tap", "click");
  void cursor.offsetWidth;   // restart the CSS animation
  cursor.classList.add(cls);
  gestureEl.textContent = label;
  flashUntil = now + 500;
}

function releasePinch() {
  if (pinch.scrolling) glide = pinch.vel;
  pinch = { ...pinch, down: false, scrolling: false };
  cursor.classList.remove("pinch", "scroll");
}

function onNoHand() {
  gestureEl.textContent = t("g.none");
  releasePinch();
  lastFrameT = 0;
  if (performance.now() - lastSeen > 600) {
    cursor.classList.add("lost");
    setHover(null);
  }
}

function setHover(el) {
  if (el === hovered) return;
  if (hovered) hovered.classList.remove("is-hand-hover");
  hovered = el;
  if (hovered) hovered.classList.add("is-hand-hover");
}

function click(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return;
  const target = el.closest("a, button, input, label, [data-chip]") || el;
  if (target.matches("input")) { target.focus(); return; }
  if (target.matches("a[href]") && openLink(target)) return;
  // Dispatch pointer events too, so canvases (stage, network) respond like a mouse click.
  const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: "mouse", isPrimary: true };
  target.dispatchEvent(new PointerEvent("pointerdown", opts));
  target.dispatchEvent(new PointerEvent("pointerup", opts));
  target.click();
}

// A pinch is not a real user gesture, so browsers block what normally needs one:
// new tabs and mail apps. Handles those links; returns false for ordinary ones.
function openLink(a) {
  if (a.protocol === "mailto:") {
    toast("✉ " + decodeURIComponent(a.href.slice(7)));
    return true;
  }
  if (a.target !== "_blank") return false;
  const w = window.open(a.href, "_blank");
  if (w) { w.opener = null; return true; }
  toast(t("hm.sametab"));
  setTimeout(() => location.assign(a.href), 700);
  return true;
}

function drawOverlay(lm) {
  const w = overlay.width, h = overlay.height;
  octx.clearRect(0, 0, w, h);
  if (!lm) return;
  const accent = getComputedStyle(root).getPropertyValue("--accent").trim() || "#f0a45c";
  octx.lineWidth = 3;
  octx.lineCap = "round";
  octx.strokeStyle = "rgba(255,255,255,0.85)";
  BONES.forEach(([a, b]) => {
    octx.beginPath();
    octx.moveTo(lm[a].x * w, lm[a].y * h);
    octx.lineTo(lm[b].x * w, lm[b].y * h);
    octx.stroke();
  });
  lm.forEach((p, i) => {
    const key = i === 4 || i === 8 || i === 5;   // pinch tips and the cursor knuckle
    octx.fillStyle = key ? accent : "#ffffff";
    octx.beginPath();
    octx.arc(p.x * w, p.y * h, key ? 7 : 4, 0, Math.PI * 2);
    octx.fill();
  });
}
