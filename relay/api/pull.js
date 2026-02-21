const { redisCommand, redisMulti, rateLimit } = require("./_redis");

const RATE_LIMIT = 10; // req/sec

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(req, res, status, body) {
  setCors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
  const path = new URL(req.url, "http://localhost").pathname;
  console.log(`${req.method} ${path} ${status}`);
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    setCors(res);
    res.statusCode = 204;
    res.end();
    const path = new URL(req.url, "http://localhost").pathname;
    console.log(`${req.method} ${path} 204`);
    return;
  }

  if (req.method !== "GET") {
    return json(req, res, 405, { error: "Method not allowed" });
  }

  const url = new URL(req.url, "http://localhost");
  const sessionId = url.searchParams.get("sessionId");
  const secret = url.searchParams.get("secret");

  if (!sessionId || !secret) {
    return json(req, res, 400, { error: "Missing sessionId/secret" });
  }

  try {
    const allowed = await rateLimit(sessionId, RATE_LIMIT);
    if (!allowed) {
      return json(req, res, 429, { error: "Rate limit exceeded" });
    }

    const storedSecret = await redisCommand("get", `s:${sessionId}`);
    if (!storedSecret || storedSecret !== secret) {
      return json(req, res, 403, { error: "Invalid session" });
    }

    let items = [];
    try {
      const result = await redisMulti([
        ["LRANGE", `q:${sessionId}`, "0", "-1"],
        ["DEL", `q:${sessionId}`],
      ]);
      items = result && result[0] ? result[0] : [];
    } catch (error) {
      // Fallback if MULTI fails for any reason.
      console.warn("MULTI failed, falling back to LRANGE+DEL");
      items = (await redisCommand("lrange", `q:${sessionId}`, "0", "-1")) || [];
      await redisCommand("del", `q:${sessionId}`);
    }

    const commands = items
      .map((item) => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return json(req, res, 200, { commands });
  } catch (error) {
    console.warn("pull error:", error instanceof Error ? error.message : String(error));
    return json(req, res, 500, { error: "Relay pull failed" });
  }
};
