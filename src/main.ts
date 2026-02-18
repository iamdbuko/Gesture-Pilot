import type { StickerMessage, UiToMainMessage } from "./shared/protocol";

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
