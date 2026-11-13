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
const PINCH_DOWN = 0.04;    // thumb–index tip distance in the camera frame (0–1)
const PINCH_UP = 0.05;      // released as soon as the tips are this far apart
const HOLD_MS = 350;        // a pinch held this long starts scrolling; shorter is a tap
const DOUBLE_MS = 600;      // second pinch must start this soon after the first ends
const SCROLL_GAIN = 1.9;    // page pixels per pixel of hand travel
const GLIDE = 0.9;          // momentum kept per frame after a scroll
const EURO_MIN_CUTOFF = 0.15;  // Hz; lower holds a resting hand steadier
const EURO_BETA = 0.002;       // how quickly the filter opens up with hand speed (px/s)
const EURO_D_CUTOFF = 0.3;     // Hz; smoothing of the speed estimate itself

let landmarker = null;
let stream = null;
let running = false;
let lastVideoTime = -1;
let pos = null;             // smoothed cursor, px
let lastFrameT = 0;
let lastSeen = 0;
let hovered = null;
let lastTrigger = null;
let pinch = { down: false, since: 0, lastY: 0, vel: 0, scrolling: false, lastTap: 0, second: false };
let pinchDist = null;       // smoothed, for the cursor display
let glide = 0;
let flashUntil = 0;
let videoAspect = 4 / 3;    // camera frame width / height
let shownLabel = { key: null, cand: null, frames: 0 };  // gesture label shown in the camera box

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
    videoAspect = (video.videoWidth || 640) / (video.videoHeight || 480);
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

// How straight a finger is, from how far its tip is from the wrist compared
// with its PIP joint. On real hands that ratio is about 0.66 for a curled
// finger and 1.37 for a straight one, so 0.85 maps to 0 and 1.2 to 1.
function extension(P, tip, pip) {
  return clamp((dist(P[0], P[tip]) / Math.max(dist(P[0], P[pip]), 1e-4) - 0.85) / 0.35, 0, 1);
}

// Pinch is the plain distance between the thumb and index fingertips in the
// camera frame; clicking and scrolling depend on this number alone.
const pinchDistance = (lm) => dist(lm[4], lm[8]);

// Scores for the gesture label. Everything is measured relative to the hand's
// own size and axis, so the result does not depend on how far the hand is from
// the camera or how it is turned in the image. The thresholds come from
// landmarks MediaPipe finds on photographs of real hands.
function gestures(lm, pinched) {
  // the video's x and y are normalised separately; make the plane isotropic
  const P = lm.map((p) => ({ x: p.x * videoAspect, y: p.y }));
  // hand size: palm length, or palm width when the palm is tipped toward the camera
  const size = Math.max(dist(P[0], P[9]), 1.15 * dist(P[5], P[17]), 1e-4);
  // height of a point above the wrist along the hand's axis (knuckles sit near 1)
  const ax = P[9].x - P[0].x, ay = P[9].y - P[0].y, al = Math.max(Math.hypot(ax, ay), 1e-4);
  const height = (i) => ((P[i].x - P[0].x) * ax + (P[i].y - P[0].y) * ay) / (al * size);

  const e = {
    index: extension(P, 8, 6),
    middle: extension(P, 12, 10),
    ring: extension(P, 16, 14),
    pinky: extension(P, 20, 18),
  };
  const folded = (1 - e.middle) * (1 - e.ring) * (1 - e.pinky);
  const tips = dist(P[4], P[8]) / size;                                              // thumb tip to index tip
  const gap = Math.min(dist(P[4], P[6]), dist(P[4], P[7]), dist(P[4], P[8])) / size;  // thumb tip to the index finger

  // Finger heart: the thumb tip rides on top of the hand, right against the
  // index finger, with the two tips not quite touching, and the other three
  // fingers folded (in real hearts they are often only loosely folded, and the
  // index is half straight). What sets it apart is the thumb: a fist keeps it
  // down at knuckle height, pointing tucks it away, a thumbs-up holds it out.
  const loose = (v) => 1 - clamp((v - 0.4) / 0.6, 0, 1);
  const heart = loose(e.middle) * loose(e.ring) * loose(e.pinky) *
    clamp((height(4) - 1.1) / 0.2, 0, 1) * clamp((0.75 - gap) / 0.2, 0, 1) * clamp((tips - 0.08) / 0.1, 0, 1);
  // Thumbs-up / thumbs-down: fingers folded and the thumb held out, away from
  // the index finger; which one depends on where the thumb points in the image.
  const tx = P[4].x - P[2].x, ty = P[4].y - P[2].y, up = -ty / Math.max(Math.hypot(tx, ty), 1e-4);
  const thumbOut = (1 - e.index) * folded * clamp((gap - 0.55) / 0.2, 0, 1);
  const like = thumbOut * clamp((up + 0.2) / 0.4, 0, 1);
  const dislike = thumbOut * clamp((-up - 0.2) / 0.4, 0, 1);
  // Middle finger only when it is clearly the one raised: straight, the other
  // three bent, and its tip standing well above its neighbours'. A relaxed,
  // half-open hand (where the middle finger is naturally the longest) is not it.
  const middleUp = e.middle > 0.7 && e.index < 0.5 && e.ring < 0.5 && e.pinky < 0.5 &&
    dist(P[0], P[12]) > 1.25 * Math.max(dist(P[0], P[8]), dist(P[0], P[16]));

  const raw = {
    open: e.index * e.middle * e.ring * e.pinky * clamp((tips - 0.2) / 0.15, 0, 1),   // not an OK sign
    point: e.index * folded * clamp((tips - 0.3) / 0.25, 0, 1) * (1 - heart),          // thumb tucked away
    victory: e.index * e.middle * (1 - e.ring) * (1 - e.pinky),
    middle: middleUp ? 1 : 0,
    like,
    dislike,
    heart: 1.5 * heart,
    fist: (1 - e.index) * folded * (1 - Math.max(like, dislike, heart)),
    // "pinch" always shows while a pinch is being acted on; otherwise only
    // when the tips touch and nothing else describes the hand better
    pinch: pinched ? 3 : 0.6 * clamp((0.3 - tips) / 0.12, 0, 1),
    hand: 0.15,                                                   // none of the above
  };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0) + 0.05;
  const scores = {};
  for (const k in raw) scores[k] = raw[k] / sum;
  return { scores };
}

// Map the index knuckle to the screen: the central 0.3–0.8 of the camera frame
// covers the whole viewport, so small hand movements reach every corner.
function knuckleToScreen(p) {
  return {
    x: clamp((1 - p.x - 0.3) * 2, 0, 1) * innerWidth,
    y: clamp((p.y - 0.3) * 2, 0, 1) * innerHeight,
  };
}

// One Euro filter (Casiez et al., 2012): heavy smoothing while the hand rests,
// opening up as it moves. Its speed estimate is itself smoothed, so landmark
// jitter is not mistaken for movement.
const lowpass = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff) / dt);
function smooth(prev, target, dt) {
  if (!prev) return { x: target.x, y: target.y, dx: 0, dy: 0 };
  const ad = lowpass(EURO_D_CUTOFF, dt);
  const dx = (prev.dx || 0) + ((target.x - prev.x) / dt - (prev.dx || 0)) * ad;
  const dy = (prev.dy || 0) + ((target.y - prev.y) / dt - (prev.dy || 0)) * ad;
  const a = lowpass(EURO_MIN_CUTOFF + EURO_BETA * Math.hypot(dx, dy), dt);
  return { x: prev.x + (target.x - prev.x) * a, y: prev.y + (target.y - prev.y) * a, dx, dy };
}

// Pinch input as a small state machine. Returns the new state and what happened.
// A pinch released before HOLD_MS is a tap; a second tap starting within
// DOUBLE_MS of the first one's release is a click; holding longer scrolls.
function pinchStep(s, isDown, y, now) {
  if (isDown && !s.down) {
    const second = !!s.lastTap && now - s.lastTap <= DOUBLE_MS;
    return { s: { ...s, down: true, since: now, lastY: y, vel: 0, scrolling: false, second, lastTap: 0 }, act: "press" };
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
    const up = { ...s, down: false, scrolling: false, second: false };
    if (s.scrolling) return { s: up, act: "scroll-end", amount: s.vel };
    if (s.second) return { s: up, act: "click" };
    return { s: { ...up, lastTap: now }, act: "tap" };
  }
  return { s, act: null };
}

// Pinch on/off with a little hysteresis so the boundary does not flicker.
// A smoothed copy of the distance only drives the cursor display.
function pinchState(d, wasDown) {
  if (!isFinite(d)) { pinchDist = null; return false; }
  pinchDist = pinchDist == null ? d : pinchDist + (d - pinchDist) * 0.5;
  return wasDown ? d < PINCH_UP : d < PINCH_DOWN;
}

function onHand(lm) {
  const now = performance.now();
  const dt = Math.min(0.1, (now - (lastFrameT || now)) / 1000) || 1 / 30;
  lastFrameT = now;
  lastSeen = now;
  cursor.classList.remove("lost");

  // index and middle knuckles both stay put while pinching; their average is
  // steadier than either one alone
  pos = smooth(pos, knuckleToScreen({ x: (lm[5].x + lm[9].x) / 2, y: (lm[5].y + lm[9].y) / 2 }), dt);
  cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

  const isDown = pinchState(pinchDistance(lm), pinch.down);
  const g = gestures(lm, isDown);
  dispatchEvent(new CustomEvent("handframe", { detail: { pts: lm.map((p) => ({ x: p.x, y: p.y })), scores: g.scores } }));

  // the cursor dot grows as the fingers close, so the visitor sees how near a pinch is
  cursor.style.setProperty("--near", pinchDist == null ? "0" : clamp((0.1 - pinchDist) / (0.1 - PINCH_DOWN), 0, 1).toFixed(2));
  // Scroll follows the hand in the camera frame, not the cursor: the cursor
  // stops at the screen edge, the hand can keep moving.
  const handY = lm[5].y * 2 * innerHeight;
  const r = pinchStep(pinch, isDown, handY, now);
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
    gestureEl.textContent = t("g." + stableLabel(top));
  }

  // hover target
  const el = document.elementFromPoint(pos.x, pos.y);
  setHover(el ? el.closest("a, button, input, [data-tilt], .pub") : null);
}

// A new gesture label must win a few frames in a row before it is shown, so
// passing poses do not flash up; the middle finger needs a little longer.
function stableLabel(top) {
  if (top === shownLabel.key) { shownLabel.cand = null; return top; }
  if (top !== shownLabel.cand) { shownLabel.cand = top; shownLabel.frames = 0; }
  shownLabel.frames++;
  if (shownLabel.frames >= (top === "middle" ? 5 : top === "heart" ? 4 : 2) || shownLabel.key == null) { shownLabel.key = top; shownLabel.cand = null; }
  return shownLabel.key;
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
  pinch = { ...pinch, down: false, scrolling: false, second: false };
  pinchDist = null;
  cursor.style.setProperty("--near", "0");
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
