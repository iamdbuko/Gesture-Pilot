import type { UiToMainMessage } from "../shared/protocol";

const PAN_STEP = 120;

function postMessage(message: UiToMainMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

const gestureToggle = document.getElementById("enable-gestures") as HTMLInputElement | null;
const gestureStatus = document.getElementById("gesture-status");

if (gestureToggle && gestureStatus) {
  const updateStatus = () => {
    gestureStatus.textContent = gestureToggle.checked ? "Gestures enabled" : "Gestures disabled";
  };
  gestureToggle.addEventListener("change", updateStatus);
  updateStatus();
}

const panButtons = document.querySelectorAll<HTMLButtonElement>("button[data-pan]");

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

const zoomInput = document.getElementById("zoom-value") as HTMLInputElement | null;
const zoomSet = document.getElementById("zoom-set");

if (zoomInput && zoomSet) {
  zoomSet.addEventListener("click", () => {
    const zoom = Number(zoomInput.value) || 1;
    postMessage({ type: "ZOOM", zoom });
  });
}

const stickerUp = document.getElementById("sticker-up");
const stickerDown = document.getElementById("sticker-down");

stickerUp?.addEventListener("click", () => {
  postMessage({ type: "STICKER", kind: "up" });
});

stickerDown?.addEventListener("click", () => {
  postMessage({ type: "STICKER", kind: "down" });
});

// Camera preview + canvas overlay.
const video = document.getElementById("camera-video") as HTMLVideoElement | null;
const canvas = document.getElementById("camera-canvas") as HTMLCanvasElement | null;
const cameraError = document.getElementById("camera-error");

if (video && canvas && cameraError) {
  const ctx = canvas.getContext("2d");
  let lastFrameTime = 0;

  const drawFrame = (time: number) => {
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
        cameraError.textContent =
          "Camera API not available in this Figma environment. Buttons still work.";
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
      cameraError.textContent = "Camera unavailable. Check permissions or use a supported device.";
      console.warn("Camera error:", error);
    }
  };

  startCamera();
}
