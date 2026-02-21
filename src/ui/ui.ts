import type { MainToUiMessage, RelayConnectMessage, RelayDisconnectMessage } from "../shared/protocol";

function postMessage(message: RelayConnectMessage | RelayDisconnectMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

const relayUrlInput = document.getElementById("relay-url") as HTMLInputElement | null;
const relaySessionInput = document.getElementById("relay-session") as HTMLInputElement | null;
const relaySecretInput = document.getElementById("relay-secret") as HTMLInputElement | null;
const connectBtn = document.getElementById("relay-connect");
const disconnectBtn = document.getElementById("relay-disconnect");
const statusDot = document.getElementById("relay-dot");
const statusText = document.getElementById("relay-status");
const lastCommand = document.getElementById("relay-last");
const lastError = document.getElementById("relay-error");

connectBtn?.addEventListener("click", () => {
  const baseUrl = relayUrlInput?.value.trim() || "";
  const sessionId = relaySessionInput?.value.trim() || "";
  const secret = relaySecretInput?.value.trim() || "";
  postMessage({ type: "RELAY_CONNECT", baseUrl, sessionId, secret });
});

disconnectBtn?.addEventListener("click", () => {
  postMessage({ type: "RELAY_DISCONNECT" });
});

window.onmessage = (event) => {
  const message = event.data && event.data.pluginMessage;
  if (!message) return;
  const payload = message as MainToUiMessage;

  if (payload.type === "RELAY_STATUS") {
    if (statusText) statusText.textContent = payload.message;
    if (statusDot) statusDot.classList.toggle("ok", payload.connected);
  }

  if (payload.type === "RELAY_LAST") {
    if (lastCommand) lastCommand.textContent = `Last command: ${payload.command}`;
  }

  if (payload.type === "RELAY_ERROR") {
    if (lastError) lastError.textContent = `Last error: ${payload.message}`;
  }
};
