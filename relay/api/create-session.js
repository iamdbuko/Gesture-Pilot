const crypto = require("crypto");
const { redisCommand } = require("./_redis");

const TTL_SECONDS = 60 * 30;

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

  if (req.method !== "POST") {
    return json(req, res, 405, { error: "Method not allowed" });
  }

  const sessionId = crypto.randomBytes(3).toString("hex");
  const secret = crypto.randomBytes(12).toString("hex");

  await redisCommand("set", `s:${sessionId}`, secret, "EX", TTL_SECONDS);
  await redisCommand("del", `q:${sessionId}`);

  return json(req, res, 200, { sessionId, secret, ttlSeconds: TTL_SECONDS });
};
