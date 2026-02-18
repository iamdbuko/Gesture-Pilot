const PAN_STEP = 120;

function postMessage(message) {
  parent.postMessage({ pluginMessage: message }, "*");
}

// Connection check.
const connDot = document.getElementById("conn-dot");
const connText = document.getElementById("conn-text");
let connected = false;

function setConnected(value) {
  connected = value;
  if (connDot) connDot.classList.toggle("ok", value);
  if (connText) connText.textContent = value ? "Connected" : "Connecting…";
}

window.addEventListener("message", (event) => {
  const message = event.data && event.data.pluginMessage;
  if (message && message.type === "PONG") {
    setConnected(true);
  }
});

setConnected(false);
setInterval(() => {
  if (!connected) postMessage({ type: "PING" });
}, 1000);
postMessage({ type: "PING" });

// Gestures toggle (UI-only).
const gestureToggle = document.getElementById("enable-gestures");
const gestureStatus = document.getElementById("gesture-status");
if (gestureToggle && gestureStatus) {
  const updateStatus = () => {
    gestureStatus.textContent = gestureToggle.checked ? "Gestures enabled" : "Gestures disabled";
  };
  gestureToggle.addEventListener("change", updateStatus);
  updateStatus();
}

// Pan buttons.
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
    postMessage({ type: "PAN", dx, dy });
  });
});

// Zoom control.
const zoomInput = document.getElementById("zoom-value");
const zoomSet = document.getElementById("zoom-set");
if (zoomInput && zoomSet) {
  zoomSet.addEventListener("click", () => {
    const zoom = Number(zoomInput.value) || 1;
    postMessage({ type: "ZOOM", zoom });
  });
}

// Stickers.
const stickerUp = document.getElementById("sticker-up");
const stickerDown = document.getElementById("sticker-down");

stickerUp && stickerUp.addEventListener("click", () => {
  postMessage({ type: "STICKER", kind: "up" });
});

stickerDown && stickerDown.addEventListener("click", () => {
  postMessage({ type: "STICKER", kind: "down" });
});

// Camera preview + canvas overlay.
const video = document.getElementById("camera-video");
const canvas = document.getElementById("camera-canvas");
const cameraError = document.getElementById("camera-error");
const cameraDiag = document.getElementById("camera-diagnostic");
const cameraStart = document.getElementById("camera-start");

if (video && canvas && cameraError) {
  const ctx = canvas.getContext("2d");
  let lastFrameTime = 0;

  const drawFrame = (time) => {
    // Throttle to ~30fps.
    if (time - lastFrameTime >= 33) {
      lastFrameTime = time;
      if (ctx && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(drawFrame);
  };

  const startCamera = async () => {
    try {
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices || !mediaDevices.getUserMedia) {
        cameraError.hidden = false;
        cameraError.textContent = "Camera API not available in this environment.";
        return;
      }

      const stream = await mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();
      video.addEventListener("loadedmetadata", () => {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      });
      requestAnimationFrame(drawFrame);
    } catch (error) {
      cameraError.hidden = false;
      if (error && error.name === "NotAllowedError") {
        cameraError.textContent = "Camera permission denied. Allow access to enable preview.";
      } else if (error && error.name === "NotFoundError") {
        cameraError.textContent = "No camera found on this device.";
      } else {
        cameraError.textContent = "Camera unavailable. Check permissions or use a supported device.";
      }
      console.warn("Camera error:", error);
    }
  };

  if (cameraDiag) {
    const secure = window.isSecureContext ? "secure" : "not secure";
    const hasMediaDevices = !!navigator.mediaDevices;
    cameraDiag.textContent = `Context: ${secure}. mediaDevices: ${hasMediaDevices ? "yes" : "no"}.`;
  }

  cameraStart && cameraStart.addEventListener("click", () => startCamera());
  // Try auto-start, but browsers may require a user gesture.
  startCamera();
}
