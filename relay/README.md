# Relay (Vercel + Upstash)

API routes:
- `POST /api/create-session`
- `POST /api/push`
- `GET /api/pull`

Env vars (Vercel project settings):
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Local dev:
```bash
vercel dev --cwd relay
```
