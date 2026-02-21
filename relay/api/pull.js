const { redisCommand, redisMulti, rateLimit } = require("./_redis");

const RATE_LIMIT = 10; // req/sec

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const url = new URL(req.url, "http://localhost");
  const sessionId = url.searchParams.get("sessionId");
  const secret = url.searchParams.get("secret");

  if (!sessionId || !secret) {
    return json(res, 400, { error: "Missing sessionId/secret" });
  }

  const allowed = await rateLimit(sessionId, RATE_LIMIT);
  if (!allowed) {
    return json(res, 429, { error: "Rate limit exceeded" });
  }

  const storedSecret = await redisCommand("get", `s:${sessionId}`);
  if (!storedSecret || storedSecret !== secret) {
    return json(res, 403, { error: "Invalid session" });
  }

  const result = await redisMulti([
    ["LRANGE", `q:${sessionId}`, "0", "-1"],
    ["DEL", `q:${sessionId}`],
  ]);

  const items = result && result[0] ? result[0] : [];
  const commands = items.map((item) => {
    try {
      return JSON.parse(item);
    } catch {
      return null;
    }
  }).filter(Boolean);

  return json(res, 200, { commands });
};
