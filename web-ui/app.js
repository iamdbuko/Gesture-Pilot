import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const RELAY_BASE_URL = "https://gesture-pilot-relay.vercel.app";
const PAN_STEP = 120;

// Relay status.
const connDot = document.getElementById("conn-dot");
const connText = document.getElementById("conn-text");
const relayError = document.getElementById("relay-error");
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
const gestureArmed = document.getElementById("gesture-armed");
const panSlider = document.getElementById("pan-sensitivity");
const panValue = document.getElementById("pan-sensitivity-value");

let gesturesEnabled = false;
let panSensitivity = 1.2;

function updateGestureStatus() {
  if (gestureStatus) {
    gestureStatus.textContent = gesturesEnabled ? "Gestures enabled" : "Gestures disabled";
  }
}

function setMode(label) {
  if (gestureMode) gestureMode.textContent = `Mode: ${label}`;
}

function setArmed(value) {
  if (gestureArmed) {
    gestureArmed.textContent = `ARMED: ${value ? "ON" : "OFF"}`;
    gestureArmed.classList.toggle("armed-on", value);
  }
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

updateGestureStatus();
setMode("IDLE");
setArmed(false);

// Relay queue + batching (max 20 req/s).
const queue = [];
const MAX_PER_FLUSH = 25;
let lastStickerAt = 0;
let flushing = false;

function enqueueCommand(command) {
  if (!sessionId || !secret) return;
  queue.push(command);
}

function enqueueSticker(command) {
  const now = Date.now();
  if (now - lastStickerAt < 1500) return;
  lastStickerAt = now;
  enqueueCommand(command);
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
    setRelayError("");
  } catch (error) {
    setConnected(false);
    setRelayError("Relay push failed. Check relay status.");
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
    enqueueCommand({ type: "PAN", dx, dy });
  });
});

const zoomInput = document.getElementById("zoom-value");
const zoomSet = document.getElementById("zoom-set");
let localZoom = 1.0;

if (zoomInput && zoomSet) {
  zoomSet.addEventListener("click", () => {
    const zoom = Number(zoomInput.value) || 1;
    localZoom = zoom;
    enqueueCommand({ type: "ZOOM", zoom });
  });
}

const stickerUp = document.getElementById("sticker-up");
const stickerDown = document.getElementById("sticker-down");

stickerUp && stickerUp.addEventListener("click", () => {
  enqueueSticker({ type: "STICKER", kind: "up" });
  setMode("THUMBS_UP");
});

stickerDown && stickerDown.addEventListener("click", () => {
  enqueueSticker({ type: "STICKER", kind: "down" });
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
let pinchActive = false;
let pinchStartDist = 0;
let pinchStartZoom = 1.0;
let smoothedPalm = null;
let state = "IDLE";
let stateSince = 0;
let armActive = false;
let openPalmAboveAt = 0;
let openPalmBelowAt = 0;
let pinchEnterAt = 0;
let pinchExitAt = 0;
let armHoldStartedAt = 0;
let lastArmToggleAt = 0;

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
  let score = 0;
  if (isFingerExtended(landmarks, 8, 6)) score += 0.25;
  if (isFingerExtended(landmarks, 12, 10)) score += 0.25;
  if (isFingerExtended(landmarks, 16, 14)) score += 0.25;
  if (isFingerExtended(landmarks, 20, 18)) score += 0.25;
  return score;
}

function areOtherFingersCurled(landmarks) {
  return (
    !isFingerExtended(landmarks, 8, 6) &&
    !isFingerExtended(landmarks, 12, 10) &&
    !isFingerExtended(landmarks, 16, 14) &&
    !isFingerExtended(landmarks, 20, 18)
  );
}

function isArmGesture(landmarks) {
  const indexExt = isFingerExtended(landmarks, 8, 6);
  const middleExt = isFingerExtended(landmarks, 12, 10);
  const ringCurled = !isFingerExtended(landmarks, 16, 14);
  const pinkyCurled = !isFingerExtended(landmarks, 20, 18);
  return indexExt && middleExt && ringCurled && pinkyCurled;
}

function detectPinch(landmarks) {
  const thumb = landmarks[4];
  const index = landmarks[8];
  const handScale = distance(landmarks[0], landmarks[9]);
  const pinchDist = distance(thumb, index);
  return pinchDist < handScale * 0.25;
}

function computePalmCenter(landmarks) {
  const points = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
  const avg = points.reduce(
    (acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }),
    { x: 0, y: 0 }
  );
  return avg;
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
    numHands: 1,
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

function handleGestures(landmarks, width, height) {
  const now = Date.now();
  if (!gesturesEnabled) {
    state = "IDLE";
    armActive = false;
    setArmed(false);
    setMode("IDLE");
    return;
  }

  const armGesture = isArmGesture(landmarks);
  if (armGesture) {
    if (!armHoldStartedAt) armHoldStartedAt = now;
    if (now - armHoldStartedAt >= 250 && now - lastArmToggleAt >= 1000) {
      armActive = !armActive;
      lastArmToggleAt = now;
      setArmed(armActive);
    }
  } else {
    armHoldStartedAt = 0;
  }

  setArmed(armActive);
  if (!armActive) {
    state = "IDLE";
    setMode("IDLE");
    return;
  }

  const thumbDir = detectThumbDirection(landmarks);
  const otherCurled = areOtherFingersCurled(landmarks);
  const openScore = openPalmScore(landmarks);

  if (openScore > 0.75) {
    if (!openPalmAboveAt) openPalmAboveAt = now;
  } else {
    openPalmAboveAt = 0;
  }
  if (openScore < 0.55) {
    if (!openPalmBelowAt) openPalmBelowAt = now;
  } else {
    openPalmBelowAt = 0;
  }

  const thumb = landmarks[4];
  const index = landmarks[8];
  const handScale = distance(landmarks[0], landmarks[9]);
  const pinchDist = distance(thumb, index) / (handScale || 1);
  const pinchEnterThreshold = 0.045;
  const pinchExitThreshold = 0.06;

  if (pinchDist < pinchEnterThreshold) {
    if (!pinchEnterAt) pinchEnterAt = now;
  } else {
    pinchEnterAt = 0;
  }
  if (pinchDist > pinchExitThreshold) {
    if (!pinchExitAt) pinchExitAt = now;
  } else {
    pinchExitAt = 0;
  }

  const locked = now - stateSince < 250;

  if (state === "IDLE" || state === "ARMED") {
    if (pinchEnterAt && now - pinchEnterAt >= 120 && !locked) {
      state = "ZOOM";
      stateSince = now;
      pinchActive = false;
    } else if (openPalmAboveAt && now - openPalmAboveAt >= 200 && !locked) {
      state = "PAN";
      stateSince = now;
    } else {
      state = "ARMED";
    }
  }

  if (state === "PAN") {
    if (openPalmBelowAt && now - openPalmBelowAt >= 150) {
      state = "ARMED";
      stateSince = now;
    }
  }

  if (state === "ZOOM") {
    if (pinchExitAt && now - pinchExitAt >= 120) {
      state = "ARMED";
      stateSince = now;
      pinchActive = false;
    }
  }

  if (state === "PAN") {
    if (now - lastPanAt >= 50) {
      const palmCenter = computePalmCenter(landmarks);
      const prev = smoothedPalm;
      const next = ema(smoothedPalm, palmCenter, 0.35);
      smoothedPalm = next;
      if (prev && next) {
        let dx = (next.x - prev.x) * width * panSensitivity;
        let dy = (next.y - prev.y) * height * panSensitivity;
        if (Math.abs(dx) + Math.abs(dy) >= 3) {
          dx = clamp(dx, -30, 30);
          dy = clamp(dy, -30, 30);
          enqueueCommand({ type: "PAN", dx, dy });
          lastPanAt = now;
        }
      }
    }
  }

  if (state === "ZOOM") {
    const currentDist = distance(thumb, index);
    if (!pinchActive) {
      pinchActive = true;
      pinchStartDist = currentDist;
      pinchStartZoom = localZoom || 1.0;
    }
    const targetZoom = clamp((pinchStartZoom * (pinchStartDist / currentDist)) || 1.0, 0.1, 6.0);
    localZoom = targetZoom;
    enqueueCommand({ type: "ZOOM", zoom: targetZoom });
  }

  if (thumbDir === "up" && otherCurled) {
    enqueueSticker({ type: "STICKER", kind: "up" });
    setMode("THUMBS_UP");
    return;
  }
  if (thumbDir === "down" && otherCurled) {
    enqueueSticker({ type: "STICKER", kind: "down" });
    setMode("THUMBS_DOWN");
    return;
  }

  setMode(state);
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
      const landmarks = results.landmarks[0];
      drawLandmarks(ctx, landmarks, width, height);
      handleGestures(landmarks, width, height);
    } else {
      setMode("IDLE");
    }
  }

  requestAnimationFrame(drawFrame);
}

if (video && canvas && cameraError) {
  cameraStart && cameraStart.addEventListener("click", () => startCamera());
  startCamera();
}
