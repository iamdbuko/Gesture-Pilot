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

export type AddTextMessage = {
  type: "ADD_TEXT";
  text: string;
  source?: "voice";
};

export type PingMessage = {
  type: "PING";
};

export type PongMessage = {
  type: "PONG";
};

export type RelayConnectMessage = {
  type: "RELAY_CONNECT";
  baseUrl: string;
  sessionId: string;
  secret: string;
  wsUrl?: string;
};

export type RelayDisconnectMessage = {
  type: "RELAY_DISCONNECT";
};

export type RelayStatusMessage = {
  type: "RELAY_STATUS";
  connected: boolean;
  message: string;
};

export type RelayLastCommandMessage = {
  type: "RELAY_LAST";
  command: string;
};

export type RelayErrorMessage = {
  type: "RELAY_ERROR";
  message: string;
};

export type RelayPollMessage = {
  type: "RELAY_POLL";
  mode: "ACTIVE" | "IDLE";
  intervalMs: number;
};

export type UiToMainMessage =
  | PanMessage
  | ZoomMessage
  | StickerMessage
  | AddTextMessage
  | PingMessage
  | RelayConnectMessage
  | RelayDisconnectMessage;
export type MainToUiMessage =
  | PongMessage
  | RelayStatusMessage
  | RelayLastCommandMessage
  | RelayErrorMessage
  | RelayPollMessage;
