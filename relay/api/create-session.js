const crypto = require("crypto");
const { redisCommand } = require("./_redis");

const TTL_SECONDS = 60 * 30;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const sessionId = crypto.randomBytes(3).toString("hex");
  const secret = crypto.randomBytes(12).toString("hex");

  await redisCommand("set", `s:${sessionId}`, secret, "EX", TTL_SECONDS);
  await redisCommand("del", `q:${sessionId}`);

  return json(res, 200, { sessionId, secret, ttlSeconds: TTL_SECONDS });
};
