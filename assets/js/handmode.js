/*
 * Hand mode: MediaPipe HandLandmarker runs in the browser; the index fingertip
 * drives a cursor, a thumb–index pinch clicks, and pointing at the top/bottom
 * edge scrolls. Each frame is also broadcast as a "handframe" event so the hero
 * stage can draw the visitor's hand as a graph.
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
const edgeTop = $("#edge-top");
const edgeBottom = $("#edge-bottom");

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const EDGE = 0.12;          // fraction of viewport height that triggers scrolling
const PINCH_DOWN = 0.32;    // pinch distance / palm size
const PINCH_UP = 0.46;

let landmarker = null;
let stream = null;
let running = false;
let lastVideoTime = -1;
let pos = { x: innerWidth / 2, y: innerHeight / 2 };
let pinched = false;
let lastSeen = 0;
let hovered = null;
let lastTrigger = null;

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
  edgeTop.classList.remove("active");
  edgeBottom.classList.remove("active");
  toast(t("hm.off"));
  dispatchEvent(new CustomEvent("handmode", { detail: { on: false } }));
}

// ------------------------------------------------------------------ per frame
function loop() {
  if (!running) return;
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const res = landmarker.detectForVideo(video, performance.now());
    const lm = res.landmarks && res.landmarks[0];
    drawOverlay(lm);
    if (lm) onHand(lm);
    else onNoHand();
  }
  requestAnimationFrame(loop);
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function extension(lm, tip, pip) {
  // >0 when the fingertip is farther from the wrist than its PIP joint
  return clamp((dist(lm[0], lm[tip]) / Math.max(dist(lm[0], lm[pip]), 1e-4) - 1) / 0.6, 0, 1);
}

function gestures(lm) {
  const palm = Math.max(dist(lm[0], lm[9]), 1e-4);
  const pinch = dist(lm[4], lm[8]) / palm;
  const e = {
    thumb: clamp((dist(lm[4], lm[17]) / Math.max(dist(lm[3], lm[17]), 1e-4) - 1) / 0.4, 0, 1),
    index: extension(lm, 8, 6),
    middle: extension(lm, 12, 10),
    ring: extension(lm, 16, 14),
    pinky: extension(lm, 20, 18),
  };
  const raw = {
    point: e.index * (1 - e.middle) * (1 - e.ring) * (1 - e.pinky),
    victory: e.index * e.middle * (1 - e.ring) * (1 - e.pinky),
    open: Math.pow((e.thumb + e.index + e.middle + e.ring + e.pinky) / 5, 2),
    fist: (1 - e.index) * (1 - e.middle) * (1 - e.ring) * (1 - e.pinky),
    pinch: clamp((0.5 - pinch) / 0.3, 0, 1),
  };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0) + 0.05;
  const scores = {};
  for (const k in raw) scores[k] = raw[k] / sum;
  return { pinch, scores };
}

function onHand(lm) {
  lastSeen = performance.now();
  cursor.classList.remove("lost");

  // Map the comfortable centre of the camera frame to the whole viewport (mirrored).
  const tip = lm[8];
  const tx = clamp((1 - tip.x - 0.15) / 0.7, 0, 1) * innerWidth;
  const ty = clamp((tip.y - 0.15) / 0.65, 0, 1) * innerHeight;
  const k = 0.35;
  pos.x += (tx - pos.x) * k;
  pos.y += (ty - pos.y) * k;
  cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

  const g = gestures(lm);
  const top = Object.entries(g.scores).sort((a, b) => b[1] - a[1])[0][0];
  gestureEl.textContent = t("g." + top);
  dispatchEvent(new CustomEvent("handframe", { detail: { pts: lm.map((p) => ({ x: p.x, y: p.y })), scores: g.scores } }));

  // pinch with hysteresis -> click
  if (!pinched && g.pinch < PINCH_DOWN) {
    pinched = true;
    cursor.classList.add("pinch");
    click(pos.x, pos.y);
  } else if (pinched && g.pinch > PINCH_UP) {
    pinched = false;
    cursor.classList.remove("pinch");
  }

  // hover target
  const el = document.elementFromPoint(pos.x, pos.y);
  setHover(el ? el.closest("a, button, input, [data-tilt], .pub") : null);

  // edge scrolling
  const yN = pos.y / innerHeight;
  edgeTop.classList.toggle("active", yN < EDGE);
  edgeBottom.classList.toggle("active", yN > 1 - EDGE);
  if (!pinched) {
    if (yN < EDGE) scrollBy(0, -Math.round(((EDGE - yN) / EDGE) * 22 + 4));
    else if (yN > 1 - EDGE) scrollBy(0, Math.round(((yN - (1 - EDGE)) / EDGE) * 22 + 4));
  }
}

function onNoHand() {
  gestureEl.textContent = t("g.none");
  if (performance.now() - lastSeen > 600) {
    cursor.classList.add("lost");
    edgeTop.classList.remove("active");
    edgeBottom.classList.remove("active");
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
  // Dispatch pointer events too, so canvases (stage, network) respond like a mouse click.
  const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: "mouse", isPrimary: true };
  target.dispatchEvent(new PointerEvent("pointerdown", opts));
  target.dispatchEvent(new PointerEvent("pointerup", opts));
  target.click();
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
    octx.fillStyle = i === 8 || i === 4 ? accent : "#ffffff";
    octx.beginPath();
    octx.arc(p.x * w, p.y * h, i === 8 || i === 4 ? 7 : 4, 0, Math.PI * 2);
    octx.fill();
  });
}
