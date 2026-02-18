export type PanMessage = {
  type: "PAN";
  dx: number;
  dy: number;
};

export type ZoomMessage = {
  type: "ZOOM";
  zoom: number;
};

export type StickerMessage = {
  type: "STICKER";
  kind: "up" | "down";
};

export type PingMessage = {
  type: "PING";
};

export type PongMessage = {
  type: "PONG";
};

export type UiToMainMessage = PanMessage | ZoomMessage | StickerMessage | PingMessage;
export type MainToUiMessage = PongMessage;
