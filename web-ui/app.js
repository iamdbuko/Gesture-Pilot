import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const RELAY_BASE_URL = "https://gesture-pilot-relay.vercel.app";
const PAN_STEP = 120;

// Relay status.
const connDot = document.getElementById("conn-dot");
const connText = document.getElementById("conn-text");
const relayError = document.getElementById("relay-error");
const relayLastPush = document.getElementById("relay-last-push");
let connected = false;

function setConnected(value) {
  connected = value;
  if (connDot) connDot.classList.toggle("ok", value);
  if (connText) connText.textContent = value ? "Relay connected" : "Relay error";
}

function setRelayError(message) {
  if (!relayError) return;
  if (!message) {
    relayError.hidden = true;
    relayError.textContent = "";
    return;
  }
  relayError.hidden = false;
  relayError.textContent = message;
}

const pairingCode = document.getElementById("pairing-code");
const pairingSecret = document.getElementById("pairing-secret");
const copyCode = document.getElementById("copy-code");
const copySecret = document.getElementById("copy-secret");

let sessionId = "";
let secret = "";

async function createSession() {
  try {
    const res = await fetch(`${RELAY_BASE_URL}/api/create-session`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("create-session failed", res.status, data);
      throw new Error(data.error || `create-session failed (${res.status})`);
    }
    sessionId = data.sessionId;
    secret = data.secret;
    if (pairingCode) pairingCode.textContent = sessionId;
    if (pairingSecret) pairingSecret.textContent = secret;
    setConnected(true);
    setRelayError("");
  } catch (error) {
    setConnected(false);
    if (connText) connText.textContent = "Relay error";
    setRelayError("Relay create-session failed. Check relay URL and CORS.");
    console.warn("Relay create-session error:", error);
  }
}

function copyText(value) {
  if (!value) return;
  navigator.clipboard?.writeText(value).catch(() => {});
}

copyCode && copyCode.addEventListener("click", () => copyText(sessionId));
copySecret && copySecret.addEventListener("click", () => copyText(secret));

createSession();

// Gestures toggle.
const gestureToggle = document.getElementById("enable-gestures");
const gestureStatus = document.getElementById("gesture-status");
const gestureMode = document.getElementById("gesture-mode");
const gestureHands = document.getElementById("gesture-hands");
const gestureHandedness = document.getElementById("gesture-handedness");
const gestureZoom = document.getElementById("gesture-zoom");
const gestureLast = document.getElementById("gesture-last");
const badgeOpenPalm = document.getElementById("badge-openpalm");
const badgeIndexOnly = document.getElementById("badge-indexonly");
const badgeZoom2H = document.getElementById("badge-zoom2h");
const panSlider = document.getElementById("pan-sensitivity");
const panValue = document.getElementById("pan-sensitivity-value");
const clutchDelayInput = document.getElementById("clutch-delay");
const clutchDelayValue = document.getElementById("clutch-delay-value");
const deadzoneInput = document.getElementById("deadzone");
const deadzoneValue = document.getElementById("deadzone-value");
const emaAlphaInput = document.getElementById("ema-alpha");
const emaAlphaValue = document.getElementById("ema-alpha-value");
const speedGainInput = document.getElementById("speed-gain");
const speedGainValue = document.getElementById("speed-gain-value");
const maxGainInput = document.getElementById("max-gain");
const maxGainValue = document.getElementById("max-gain-value");
const yBoostInput = document.getElementById("y-boost");
const yBoostValue = document.getElementById("y-boost-value");

let gesturesEnabled = false;
let panSensitivity = 1.2;
let clutchDelayMs = 250;
let deadzone = 1.5;
let emaAlpha = 0.22;
let speedGain = 0.03;
let maxGain = 3.0;
let yBoost = 1.4;
let activeRadiusPx = 90;

function updateGestureStatus() {
  if (gestureStatus) {
    gestureStatus.textContent = gesturesEnabled ? "Gestures enabled" : "Gestures disabled";
  }
}

function setMode(label) {
  if (gestureMode) gestureMode.textContent = `Mode: ${label}`;
}

function setHands(count) {
  if (gestureHands) gestureHands.textContent = `Hands: ${count}`;
}

function setHandedness(text) {
  if (gestureHandedness) gestureHandedness.textContent = `Handedness: ${text}`;
}

function setZoomDebug(s, s0) {
  if (gestureZoom) gestureZoom.textContent = `Zoom: S ${s} / S0 ${s0}`;
}

function setLastCommand(text) {
  if (gestureLast) gestureLast.textContent = `Last cmd: ${text}`;
}

function setBadgeActive(el, active) {
  if (!el) return;
  el.classList.toggle("active", !!active);
}

if (gestureToggle) {
  gesturesEnabled = gestureToggle.checked;
  gestureToggle.addEventListener("change", () => {
    gesturesEnabled = gestureToggle.checked;
    updateGestureStatus();
  });
}

if (panSlider && panValue) {
  panSlider.addEventListener("input", () => {
    panSensitivity = Number(panSlider.value) || 1.0;
    panValue.textContent = panSensitivity.toFixed(1);
  });
}

if (clutchDelayInput && clutchDelayValue) {
  clutchDelayInput.addEventListener("input", () => {
    clutchDelayMs = Number(clutchDelayInput.value) || 250;
    clutchDelayValue.textContent = String(clutchDelayMs);
  });
}

if (deadzoneInput && deadzoneValue) {
  deadzoneInput.addEventListener("input", () => {
    deadzone = Number(deadzoneInput.value) || 0;
    deadzoneValue.textContent = deadzone.toFixed(1);
  });
}

if (emaAlphaInput && emaAlphaValue) {
  emaAlphaInput.addEventListener("input", () => {
    emaAlpha = Number(emaAlphaInput.value) || 0.2;
    emaAlphaValue.textContent = emaAlpha.toFixed(2);
  });
}

if (speedGainInput && speedGainValue) {
  speedGainInput.addEventListener("input", () => {
    speedGain = Number(speedGainInput.value) || 0.03;
    speedGainValue.textContent = speedGain.toFixed(3);
  });
}

if (maxGainInput && maxGainValue) {
  maxGainInput.addEventListener("input", () => {
    maxGain = Number(maxGainInput.value) || 3.0;
    maxGainValue.textContent = maxGain.toFixed(2);
  });
}

if (yBoostInput && yBoostValue) {
  yBoostInput.addEventListener("input", () => {
    yBoost = Number(yBoostInput.value) || 1.0;
    yBoostValue.textContent = yBoost.toFixed(1);
  });
}


updateGestureStatus();
setMode("IDLE");
setHands(0);
setHandedness("—");
setZoomDebug("—", "—");

// Relay queue + batching (max 20 req/s).
const queue = [];
const MAX_PER_FLUSH = 25;
let lastStickerAt = 0;
let flushing = false;

function enqueueCommand(command) {
  if (!sessionId || !secret) return;
  queue.push(command);
  flushQueue();
}

function enqueueSticker(command) {
  const now = Date.now();
  if (now - lastStickerAt < 1500) return;
  lastStickerAt = now;
  enqueueCommand(command);
}

function emitCommand(command, label) {
  enqueueCommand(command);
  if (label) setLastCommand(label);
}

function emitSticker(command, label) {
  enqueueSticker(command);
  if (label) setLastCommand(label);
}

async function flushQueue() {
  if (flushing || queue.length === 0 || !sessionId || !secret) return;
  flushing = true;
  const batch = queue.splice(0, MAX_PER_FLUSH);
  try {
    const res = await fetch(`${RELAY_BASE_URL}/api/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, secret, commands: batch }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("push failed", res.status, data);
      throw new Error(data.error || `push failed (${res.status})`);
    }
    setConnected(true);
    if (relayLastPush) relayLastPush.textContent = `Last push: ok (${batch.length}) [${sessionId}]`;
    setRelayError("");
  } catch (error) {
    setConnected(false);
    setRelayError("Relay push failed. Check relay status.");
    if (relayLastPush) relayLastPush.textContent = `Last push: error [${sessionId}]`;
    console.warn("Relay push error:", error);
  } finally {
    flushing = false;
  }
}

setInterval(() => {
  flushQueue();
}, 50);

// Manual controls (still available).
const panButtons = document.querySelectorAll("button[data-pan]");
panButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const dir = button.dataset.pan;
    let dx = 0;
    let dy = 0;
    if (dir === "up") dy = -PAN_STEP;
    if (dir === "down") dy = PAN_STEP;
    if (dir === "left") dx = -PAN_STEP;
    if (dir === "right") dx = PAN_STEP;
    emitCommand({ type: "PAN", dx, dy }, `PAN ${dx.toFixed(1)}, ${dy.toFixed(1)}`);
  });
});

const zoomInput = document.getElementById("zoom-value");
const zoomSet = document.getElementById("zoom-set");
let localZoom = 1.0;

if (zoomInput && zoomSet) {
  zoomSet.addEventListener("click", () => {
    const zoom = Number(zoomInput.value) || 1;
    localZoom = zoom;
    emitCommand({ type: "ZOOM", zoom }, `ZOOM ${zoom.toFixed(2)}`);
  });
}

const stickerUp = document.getElementById("sticker-up");
const stickerDown = document.getElementById("sticker-down");

stickerUp && stickerUp.addEventListener("click", () => {
  emitSticker({ type: "STICKER", kind: "up" }, "STICKER up");
  setMode("THUMBS_UP");
});

stickerDown && stickerDown.addEventListener("click", () => {
  emitSticker({ type: "STICKER", kind: "down" }, "STICKER down");
  setMode("THUMBS_DOWN");
});

// Camera preview + landmark overlay.
const video = document.getElementById("camera-video");
const canvas = document.getElementById("camera-canvas");
const cameraError = document.getElementById("camera-error");
const cameraDiag = document.getElementById("camera-diagnostic");
const cameraStart = document.getElementById("camera-start");

let handLandmarker = null;
let lastVideoTime = -1;
let lastPanAt = 0;
let smoothedIndex = null;
let mode = "IDLE";
let modeSince = 0;
let panEnterAt = 0;
let panExitAt = 0;
let zoomEnterAt = 0;
let zoomExitAt = 0;
let zoomS0 = 0;
let zoomRatioEma = 1.0;
let zoom0 = 1.0;
let thumbsHoldAt = 0;
let thumbsCandidate = "none";
let lastThumbsAt = { up: 0, down: 0 };
let panEngaged = false;
let lastIndexSeenAt = 0;
let activeOrigin = null;
let inertialVx = 0;
let inertialVy = 0;
let inertialActive = false;
let lastTwoFinger = false;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function ema(prev, next, alpha) {
  if (!prev) return next;
  return {
    x: prev.x + alpha * (next.x - prev.x),
    y: prev.y + alpha * (next.y - prev.y),
  };
}

function isFingerExtended(landmarks, tip, pip) {
  return landmarks[tip].y < landmarks[pip].y;
}

function detectThumbDirection(landmarks) {
  const tip = landmarks[4];
  const mcp = landmarks[2];
  const dy = tip.y - mcp.y;
  if (dy < -0.08) return "up";
  if (dy > 0.08) return "down";
  return "none";
}

function isOpenPalm(landmarks) {
  return (
    isFingerExtended(landmarks, 8, 6) &&
    isFingerExtended(landmarks, 12, 10) &&
    isFingerExtended(landmarks, 16, 14) &&
    isFingerExtended(landmarks, 20, 18)
  );
}

function openPalmScore(landmarks) {
  let extended = 0;
  if (isFingerExtended(landmarks, 8, 6)) extended += 1;
  if (isFingerExtended(landmarks, 12, 10)) extended += 1;
  if (isFingerExtended(landmarks, 16, 14)) extended += 1;
  if (isFingerExtended(landmarks, 20, 18)) extended += 1;
  return extended / 4;
}

function areOtherFingersCurled(landmarks) {
  return (
    !isFingerExtended(landmarks, 8, 6) &&
    !isFingerExtended(landmarks, 12, 10) &&
    !isFingerExtended(landmarks, 16, 14) &&
    !isFingerExtended(landmarks, 20, 18)
  );
}

function countCurledFingers(landmarks) {
  let curled = 0;
  if (!isFingerExtended(landmarks, 8, 6)) curled += 1;
  if (!isFingerExtended(landmarks, 12, 10)) curled += 1;
  if (!isFingerExtended(landmarks, 16, 14)) curled += 1;
  if (!isFingerExtended(landmarks, 20, 18)) curled += 1;
  return curled;
}

function isArmGesture(landmarks) {
  const indexExt = isFingerExtended(landmarks, 8, 6);
  const middleExt = isFingerExtended(landmarks, 12, 10);
  const ringCurled = !isFingerExtended(landmarks, 16, 14);
  const pinkyCurled = !isFingerExtended(landmarks, 20, 18);
  return indexExt && middleExt && ringCurled && pinkyCurled;
}

function isTwoFingerGesture(landmarks) {
  const indexExt = isFingerExtended(landmarks, 8, 6);
  const middleExt = isFingerExtended(landmarks, 12, 10);
  const ringCurled = !isFingerExtended(landmarks, 16, 14);
  const pinkyCurled = !isFingerExtended(landmarks, 20, 18);
  return indexExt && middleExt && ringCurled && pinkyCurled;
}

function pinchDistanceNormalized(landmarks) {
  const thumb = landmarks[4];
  const index = landmarks[8];
  const handScale = distance(landmarks[0], landmarks[9]) || 1;
  return distance(thumb, index) / handScale;
}

function computePalmCenter(landmarks) {
  const points = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
  const avg = points.reduce(
    (acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }),
    { x: 0, y: 0 }
  );
  return avg;
}

function maxMinArea(landmarks) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  landmarks.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  const w = Math.max(maxX - minX, 1e-6);
  const h = Math.max(maxY - minY, 1e-6);
  return w * h;
}

async function initHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    },
    runningMode: "VIDEO",
    numHands: 2,
  });
}

function drawLandmarks(ctx, landmarks, width, height) {
  ctx.strokeStyle = "rgba(48,185,90,0.8)";
  ctx.fillStyle = "rgba(48,185,90,0.9)";
  ctx.lineWidth = 2;

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17],
  ];

  connections.forEach(([a, b]) => {
    const p1 = landmarks[a];
    const p2 = landmarks[b];
    ctx.beginPath();
    ctx.moveTo(p1.x * width, p1.y * height);
    ctx.lineTo(p2.x * width, p2.y * height);
    ctx.stroke();
  });

  landmarks.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function handleGestures(landmarksList, handednessList, width, height) {
  const now = Date.now();
  const handsCount = landmarksList.length;
  setHands(handsCount);
  setHandedness(
    handednessList
      .map((h) => (h && h[0] ? h[0].categoryName : "Unknown"))
      .join(", ") || "—"
  );

  if (!gesturesEnabled || handsCount === 0) {
    mode = "IDLE";
    setMode("IDLE");
    setBadgeActive(badgeOpenPalm, false);
    setBadgeActive(badgeIndexOnly, false);
    setBadgeActive(badgeZoom2H, false);
    return;
  }

  const rightIndex = handednessList.findIndex((h) => h && h[0] && h[0].categoryName === "Right");
  let rightHand = rightIndex >= 0 ? landmarksList[rightIndex] : null;
  if (!rightHand && handsCount === 1) {
    // Fallback to the only detected hand to reduce false negatives from handedness flips.
    rightHand = landmarksList[0];
  }

  // ZOOM_2H has highest priority.
  let openA = false;
  let openB = false;
  if (handsCount >= 2) {
    openA = openPalmScore(landmarksList[0]) >= 0.75;
    openB = openPalmScore(landmarksList[1]) >= 0.75;
    setBadgeActive(badgeOpenPalm, openA && openB);
    if (openA && openB) {
      if (!zoomEnterAt) zoomEnterAt = now;
    } else {
      zoomEnterAt = 0;
    }
  } else {
    zoomEnterAt = 0;
  }

  if (handsCount < 2 || !openA || !openB) {
    if (!zoomExitAt) zoomExitAt = now;
  } else {
    zoomExitAt = 0;
  }

  if ((mode !== "ZOOM" && handsCount >= 2 && zoomEnterAt && now - zoomEnterAt >= 200) || mode === "ZOOM") {
    if (mode !== "ZOOM") {
      mode = "ZOOM";
      modeSince = now;
      zoomS0 = ((maxMinArea(landmarksList[0]) + maxMinArea(landmarksList[1])) / 2) || 1;
      zoom0 = localZoom || 1.0;
      zoomRatioEma = 1.0;
      setMode("ZOOM");
    }
    setBadgeActive(badgeZoom2H, true);

    if (handsCount < 2 || !openA || !openB) {
      if (now - modeSince >= 400 && zoomExitAt && now - zoomExitAt >= 150) {
        mode = "IDLE";
        setMode("IDLE");
        setBadgeActive(badgeZoom2H, false);
        return;
      }
      setZoomDebug("—", zoomS0 ? zoomS0.toFixed(3) : "—");
      return;
    }

    if (handsCount < 2 && now - modeSince >= 400 && zoomExitAt && now - zoomExitAt >= 150) {
      mode = "IDLE";
      setMode("IDLE");
      setBadgeActive(badgeZoom2H, false);
      return;
    }

    if (handsCount >= 2) {
      const s = ((maxMinArea(landmarksList[0]) + maxMinArea(landmarksList[1])) / 2) || 1;
      const ratioRaw = clamp(zoomS0 / s, 0.1, 10);
      zoomRatioEma = 0.7 * zoomRatioEma + 0.3 * ratioRaw;
      if (Math.abs(zoomRatioEma - 1) > 0.02) {
        const targetZoom = clamp(zoom0 * zoomRatioEma, 0.1, 6.0);
        localZoom = targetZoom;
        emitCommand({ type: "ZOOM", zoom: targetZoom }, `ZOOM ${targetZoom.toFixed(2)}`);
      }
      setZoomDebug(s.toFixed(3), zoomS0.toFixed(3));
    }
    return;
  }

  // PAN (right hand, two-finger gesture).
  if (rightHand) {
    const twoFinger = isTwoFingerGesture(rightHand);
    setBadgeActive(badgeIndexOnly, twoFinger);
    if (twoFinger) {
      lastIndexSeenAt = now;
      if (!panEnterAt) panEnterAt = now;
      lastTwoFinger = true;
    } else {
      panEnterAt = 0;
      if (lastTwoFinger) {
        // Gesture just ended: reset to avoid release-jitter.
        smoothedIndex = null;
        inertialActive = false;
        inertialVx = 0;
        inertialVy = 0;
        lastPanAt = now;
      }
      lastTwoFinger = false;
    }
    if (!twoFinger) {
      if (!panExitAt) panExitAt = now;
    } else {
      panExitAt = 0;
    }

    if ((mode !== "PAN" && panEnterAt && now - panEnterAt >= 150) || mode === "PAN") {
      if (mode !== "PAN") {
        mode = "PAN";
        modeSince = now;
        panEngaged = true;
        smoothedIndex = null;
        inertialActive = false;
      }
      if (!twoFinger && panExitAt && now - panExitAt >= clutchDelayMs) {
        mode = "IDLE";
        setMode("IDLE");
        panEngaged = false;
        inertialActive = true;
        return;
      }

      if (!twoFinger) {
        return;
      }

      const tipA = rightHand[8];
      const tipB = rightHand[12];
      const tip = { x: (tipA.x + tipB.x) / 2, y: (tipA.y + tipB.y) / 2 };
      const prev = smoothedIndex;
      const next = ema(smoothedIndex, { x: tip.x, y: tip.y }, emaAlpha);
      smoothedIndex = next;

      if (prev && next && now - lastPanAt >= 50) {
        let dx = (next.x - prev.x) * width;
        let dy = (next.y - prev.y) * height * yBoost;

        const speed = Math.hypot(dx, dy);
        const gain = clamp(0.4 + speed * speedGain, 0.4, maxGain);
        dx = dx * panSensitivity * gain;
        dy = dy * panSensitivity * gain;
        if (Math.abs(dx) + Math.abs(dy) >= deadzone) {
          dx = clamp(dx, -30, 30);
          dy = clamp(dy, -30, 30);
          emitCommand({ type: "PAN", dx, dy }, `PAN ${dx.toFixed(1)}, ${dy.toFixed(1)}`);
          inertialVx = dx;
          inertialVy = dy;
          lastPanAt = now;
        }
      }
      setMode("PAN");
      return;
    }
  }

  // Stickers (right hand thumbs up/down hold).
  // Thumbs temporarily disabled.

  setZoomDebug("—", "—");
  setBadgeActive(badgeIndexOnly, false);
  setBadgeActive(badgeZoom2H, false);
  if (inertialActive && !panEngaged) {
    // Apply inertia when pan stops.
    inertialVx *= 0.86;
    inertialVy *= 0.86;
    if (Math.abs(inertialVx) + Math.abs(inertialVy) > 0.8) {
      emitCommand({ type: "PAN", dx: inertialVx, dy: inertialVy }, `PAN ${inertialVx.toFixed(1)}, ${inertialVy.toFixed(1)}`);
    } else {
      inertialActive = false;
      inertialVx = 0;
      inertialVy = 0;
    }
  }
  setMode("IDLE");
}

async function startCamera() {
  try {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices || !mediaDevices.getUserMedia) {
      if (cameraError) {
        cameraError.hidden = false;
        cameraError.textContent = "Camera API not available in this environment.";
      }
      return;
    }

    const stream = await mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();

    if (cameraDiag) {
      const secure = window.isSecureContext ? "secure" : "not secure";
      const hasMediaDevices = !!navigator.mediaDevices;
      cameraDiag.textContent = `Context: ${secure}. mediaDevices: ${hasMediaDevices ? "yes" : "no"}.`;
    }

    await initHandLandmarker();

    requestAnimationFrame(drawFrame);
  } catch (error) {
    if (cameraError) {
      cameraError.hidden = false;
      if (error && error.name === "NotAllowedError") {
        cameraError.textContent = "Camera permission denied. Allow access to enable preview.";
      } else if (error && error.name === "NotFoundError") {
        cameraError.textContent = "No camera found on this device.";
      } else {
        cameraError.textContent = "Camera unavailable. Check permissions or use a supported device.";
      }
    }
    console.warn("Camera error:", error);
  }
}

function drawFrame() {
  if (!video || !canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = (canvas.width = video.videoWidth || canvas.width || 640);
  const height = (canvas.height = video.videoHeight || canvas.height || 480);

  ctx.drawImage(video, 0, 0, width, height);

  if (handLandmarker && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const results = handLandmarker.detectForVideo(video, performance.now());
    if (results.landmarks && results.landmarks.length > 0) {
      results.landmarks.forEach((landmarks) => drawLandmarks(ctx, landmarks, width, height));
      handleGestures(results.landmarks, results.handednesses || [], width, height);
    } else {
      setHands(0);
      setHandedness("—");
      setZoomDebug("—", "—");
      setMode("IDLE");
    }
  }

  requestAnimationFrame(drawFrame);
}

if (video && canvas && cameraError) {
  cameraStart && cameraStart.addEventListener("click", () => startCamera());
  startCamera();
}
