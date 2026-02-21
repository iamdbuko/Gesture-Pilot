const { redisCommand, rateLimit } = require("./_redis");

const MAX_COMMANDS = 50;
const RATE_LIMIT = 20; // req/sec

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const bodyRaw = await readBody(req);
  let body = null;
  try {
    body = JSON.parse(bodyRaw || "{}");
  } catch {
    return json(res, 400, { error: "Invalid JSON" });
  }

  const { sessionId, secret, commands } = body || {};
  if (!sessionId || !secret || !Array.isArray(commands)) {
    return json(res, 400, { error: "Missing sessionId/secret/commands" });
  }

  const allowed = await rateLimit(sessionId, RATE_LIMIT);
  if (!allowed) {
    return json(res, 429, { error: "Rate limit exceeded" });
  }

  const storedSecret = await redisCommand("get", `s:${sessionId}`);
  if (!storedSecret || storedSecret !== secret) {
    return json(res, 403, { error: "Invalid session" });
  }

  const batch = commands.slice(0, MAX_COMMANDS).map((cmd) => JSON.stringify(cmd));
  if (batch.length === 0) {
    return json(res, 200, { ok: true, pushed: 0 });
  }

  await redisCommand("rpush", `q:${sessionId}`, ...batch);
  return json(res, 200, { ok: true, pushed: batch.length });
};
