const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  throw new Error("Missing Upstash env vars: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
}

async function redisCommand(command, ...args) {
  const res = await fetch(`${UPSTASH_URL}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
    },
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `Upstash error: ${res.status}`);
  }
  return data.result;
}

async function redisMulti(commands) {
  const res = await fetch(`${UPSTASH_URL}/multi`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `Upstash error: ${res.status}`);
  }
  return data.result;
}

async function rateLimit(sessionId, limitPerSecond) {
  const key = `rl:${sessionId}`;
  const count = await redisCommand("incr", key);
  if (count === 1) {
    await redisCommand("expire", key, 1);
  }
  return count <= limitPerSecond;
}

module.exports = {
  redisCommand,
  redisMulti,
  rateLimit,
};
