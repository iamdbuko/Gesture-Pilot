const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("Gesture Pilot WS Relay\n");
});

const wss = new WebSocketServer({ server });

// sessionId -> { secret, source, sinks:Set }
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { secret: null, source: null, sinks: new Set() });
  }
  return sessions.get(sessionId);
}

function cleanupSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (!session.source && session.sinks.size === 0) {
    sessions.delete(sessionId);
  }
}

function safeSend(ws, message) {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // Ignore send errors
  }
}

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.sessionId = null;
  ws.role = null;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      safeSend(ws, { type: "error", message: "Invalid JSON" });
      ws.close();
      return;
    }

    if (!ws.role) {
      if (msg.type !== "hello" || !msg.role || !msg.sessionId || !msg.secret) {
        safeSend(ws, { type: "error", message: "Invalid hello" });
        ws.close();
        return;
      }

      const { role, sessionId, secret } = msg;
      if (role !== "source" && role !== "sink") {
        safeSend(ws, { type: "error", message: "Invalid role" });
        ws.close();
        return;
      }

      const session = getSession(sessionId);
      if (session.secret && session.secret !== secret) {
        safeSend(ws, { type: "error", message: "Invalid session" });
        ws.close();
        return;
      }

      session.secret = secret;
      ws.sessionId = sessionId;
      ws.role = role;

      if (role === "source") {
        session.source = ws;
      } else {
        session.sinks.add(ws);
      }

      safeSend(ws, { type: "hello", ok: true });
      return;
    }

    // Only source can send commands.
    if (ws.role !== "source") {
      safeSend(ws, { type: "error", message: "Not a source" });
      return;
    }

    const session = sessions.get(ws.sessionId);
    if (!session) return;

    // Relay command to sinks.
    if (msg && msg.type) {
      session.sinks.forEach((sink) => {
        if (sink.readyState === sink.OPEN) {
          safeSend(sink, msg);
        }
      });
    }
  });

  ws.on("close", () => {
    const sessionId = ws.sessionId;
    if (!sessionId) return;
    const session = sessions.get(sessionId);
    if (!session) return;
    if (ws.role === "source" && session.source === ws) {
      session.source = null;
    }
    if (ws.role === "sink") {
      session.sinks.delete(ws);
    }
    cleanupSession(sessionId);
  });
});

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});

server.listen(PORT, () => {
  console.log(`WS relay listening on ${PORT}`);
});
