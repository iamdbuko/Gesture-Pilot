import type { StickerMessage, UiToMainMessage, MainToUiMessage } from "./shared/protocol";

const UI_WIDTH = 320;
const UI_HEIGHT = 360;

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT });

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
  }
};

type RelayState = {
  baseUrl: string;
  sessionId: string;
  secret: string;
  intervalId: number | null;
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

function relayDisconnect() {
  if (relayState?.intervalId != null) {
    clearInterval(relayState.intervalId);
  }
  relayState = null;
  setRelayStatus(false, "Disconnected");
}

async function relayConnect(baseUrl: string, sessionId: string, secret: string) {
  relayDisconnect();

  if (!baseUrl || !sessionId || !secret) {
    setRelayStatus(false, "Missing relay fields");
    return;
  }

  relayState = {
    baseUrl: baseUrl.replace(/\/$/, ""),
    sessionId,
    secret,
    intervalId: null,
  };

  setRelayStatus(true, "Connected");

  const poll = async () => {
    if (!relayState) return;
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
      for (const cmd of commands) {
        await handleRelayCommand(cmd);
      }
    } catch (error) {
      setRelayStatus(false, "Relay error");
    }
  };

  relayState.intervalId = setInterval(poll, 200) as unknown as number;
  poll();
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
  }
}
