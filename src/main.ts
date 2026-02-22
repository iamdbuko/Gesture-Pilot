import type { AddTextMessage, StickerMessage, UiToMainMessage, MainToUiMessage } from "./shared/protocol";

const UI_WIDTH = 320;
const UI_HEIGHT = 360;

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT });

figma.ui.postMessage({ type: "RELAY_STATUS", connected: false, message: "Main build: 2026-02-21-23:55" });

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

async function createStickerAtCenter(message: StickerMessage): Promise<void> {
  const center = figma.viewport.center;
  const size = 88;

  const rect = figma.createRectangle();
  rect.resize(size, size);
  rect.cornerRadius = 18;
  rect.fills = [
    {
      type: "SOLID",
      color: message.kind === "up" ? { r: 0.2, g: 0.75, b: 0.3 } : { r: 0.85, g: 0.2, b: 0.2 },
    },
  ];

  const text = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  text.fontSize = 40;
  text.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  text.textAutoResize = "WIDTH_AND_HEIGHT";

  try {
    text.characters = message.kind === "up" ? "👍" : "👎";
  } catch {
    text.characters = message.kind === "up" ? "UP" : "DOWN";
  }

  text.x = rect.x + (rect.width - text.width) / 2;
  text.y = rect.y + (rect.height - text.height) / 2;

  const group = figma.group([rect, text], figma.currentPage);
  group.x = center.x - group.width / 2;
  group.y = center.y - group.height / 2;

  figma.currentPage.selection = [group];
}

async function createTextAtCenter(message: AddTextMessage): Promise<void> {
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  } catch {
    setRelayError("Failed to load Inter Regular. Text not created.");
    return;
  }

  const text = figma.createText();
  text.fontName = { family: "Inter", style: "Regular" };
  text.fontSize = 32;
  text.fills = [{ type: "SOLID", color: { r: 0.12, g: 0.12, b: 0.14 } }];
  text.textAutoResize = "WIDTH_AND_HEIGHT";
  text.characters = message.text || "";

  const center = figma.viewport.center;
  text.x = center.x - text.width / 2;
  text.y = center.y - text.height / 2;

  figma.currentPage.selection = [text];
}

figma.ui.onmessage = async (message: UiToMainMessage) => {
  if (!message || typeof message !== "object" || !("type" in message)) {
    return;
  }

  switch (message.type) {
    case "PING": {
      figma.ui.postMessage({ type: "PONG" });
      break;
    }
    case "RELAY_CONNECT": {
      await relayConnect(message.baseUrl, message.sessionId, message.secret);
      break;
    }
    case "RELAY_DISCONNECT": {
      relayDisconnect();
      break;
    }
    case "PAN": {
      const zoom = figma.viewport.zoom || 1;
      const center = figma.viewport.center;
      figma.viewport.center = {
        x: center.x + message.dx / zoom,
        y: center.y + message.dy / zoom,
      };
      break;
    }
    case "ZOOM": {
      const center = figma.viewport.center;
      const clamped = clamp(message.zoom, 0.1, 6.0);
      figma.viewport.zoom = clamped;
      figma.viewport.center = center;
      break;
    }
    case "STICKER": {
      await createStickerAtCenter(message);
      break;
    }
    case "ADD_TEXT": {
      await createTextAtCenter(message);
      break;
    }
  }
};

type RelayState = {
  baseUrl: string;
  sessionId: string;
  secret: string;
  intervalId: number | null;
  active: boolean;
  inFlight: boolean;
  pollToken: number;
  lastCommandAt: number;
  currentPollMs: number;
};

let relayState: RelayState | null = null;

function postUi(message: MainToUiMessage) {
  figma.ui.postMessage(message);
}

function setRelayStatus(connected: boolean, message: string) {
  postUi({ type: "RELAY_STATUS", connected, message });
}

function setLastCommand(command: string) {
  postUi({ type: "RELAY_LAST", command });
}

function setRelayError(message: string) {
  const text = typeof message === "string" ? message : JSON.stringify(message);
  postUi({ type: "RELAY_ERROR", message: text });
}

function relayDisconnect() {
  if (relayState?.intervalId != null) {
    clearTimeout(relayState.intervalId);
  }
  if (relayState) {
    relayState.active = false;
  }
  relayState = null;
  setRelayStatus(false, "Disconnected");
  setRelayError("—");
}

async function relayConnect(baseUrl: string, sessionId: string, secret: string) {
  relayDisconnect();

  if (!baseUrl || !sessionId || !secret) {
    setRelayStatus(false, "Missing relay fields");
    setRelayError("Missing relay fields");
    return;
  }

  relayState = {
    baseUrl: baseUrl.replace(/\/$/, ""),
    sessionId,
    secret,
    intervalId: null,
    active: true,
    inFlight: false,
    pollToken: Date.now(),
    lastCommandAt: 0,
    currentPollMs: 80,
  };

  setRelayStatus(true, `Connected (${sessionId})`);
  setRelayError("—");

  const ACTIVE_POLL_MS = 30;
  const IDLE_POLL_MS = 300;
  const BURST_POLL_MS = 20;
  const BURST_WINDOW_MS = 800;
  let burstUntil = 0;

  const poll = async (token: number) => {
    if (!relayState || !relayState.active || relayState.pollToken !== token) return;
    if (relayState.inFlight) {
      relayState.intervalId = setTimeout(() => poll(token), relayState.currentPollMs) as unknown as number;
      return;
    }
    relayState.inFlight = true;
    try {
      const url =
        `${relayState.baseUrl}/api/pull?sessionId=` +
        encodeURIComponent(relayState.sessionId) +
        `&secret=` +
        encodeURIComponent(relayState.secret);
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Relay pull failed");
      const commands = Array.isArray(data.commands) ? data.commands : [];
      if (commands.length > 0) {
        relayState.lastCommandAt = Date.now();
        burstUntil = relayState.lastCommandAt + BURST_WINDOW_MS;
        relayState.currentPollMs = BURST_POLL_MS;
        figma.ui.postMessage({ type: "RELAY_POLL", mode: "ACTIVE", intervalMs: relayState.currentPollMs });
      } else {
        const now = Date.now();
        if (relayState.lastCommandAt && now - relayState.lastCommandAt > 2000) {
          relayState.currentPollMs = IDLE_POLL_MS;
          figma.ui.postMessage({ type: "RELAY_POLL", mode: "IDLE", intervalMs: relayState.currentPollMs });
        } else if (burstUntil && now < burstUntil) {
          relayState.currentPollMs = BURST_POLL_MS;
          figma.ui.postMessage({ type: "RELAY_POLL", mode: "ACTIVE", intervalMs: relayState.currentPollMs });
        } else {
          relayState.currentPollMs = ACTIVE_POLL_MS;
          figma.ui.postMessage({ type: "RELAY_POLL", mode: "ACTIVE", intervalMs: relayState.currentPollMs });
        }
      }
      for (const cmd of commands) {
        await handleRelayCommand(cmd);
      }
    } catch (error) {
      const msg = String(error instanceof Error ? error.message : error);
      // Ignore internal callback id errors but keep connection alive.
      if (!msg.includes("callback with invalid id")) {
        setRelayStatus(true, `Polling (${relayState.sessionId})`);
        setRelayError(msg);
      }
      relayState.currentPollMs = Math.min(relayState.currentPollMs * 2, 2000);
      figma.ui.postMessage({ type: "RELAY_POLL", mode: "IDLE", intervalMs: relayState.currentPollMs });
    } finally {
      if (relayState) {
        relayState.inFlight = false;
        relayState.intervalId = setTimeout(() => poll(token), relayState.currentPollMs) as unknown as number;
      }
    }
  };

  const token = relayState.pollToken;
  relayState.intervalId = setTimeout(() => poll(token), relayState.currentPollMs) as unknown as number;
  poll(token);
}

async function handleRelayCommand(command: any) {
  if (!command || typeof command !== "object" || !("type" in command)) {
    return;
  }
  switch (command.type) {
    case "PAN": {
      const zoom = figma.viewport.zoom || 1;
      const center = figma.viewport.center;
      figma.viewport.center = {
        x: center.x + Number(command.dx || 0) / zoom,
        y: center.y + Number(command.dy || 0) / zoom,
      };
      setLastCommand(`PAN ${command.dx}, ${command.dy}`);
      break;
    }
    case "ZOOM": {
      const center = figma.viewport.center;
      const clamped = clamp(Number(command.zoom || 1), 0.1, 6.0);
      figma.viewport.zoom = clamped;
      figma.viewport.center = center;
      setLastCommand(`ZOOM ${clamped}`);
      break;
    }
    case "STICKER": {
      await createStickerAtCenter(command);
      setLastCommand(`STICKER ${command.kind}`);
      break;
    }
    case "ADD_TEXT": {
      await createTextAtCenter(command);
      setLastCommand(`ADD_TEXT ${String(command.text || "").slice(0, 40)}`);
      break;
    }
  }
}
