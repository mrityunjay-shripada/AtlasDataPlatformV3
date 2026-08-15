# Deploy Atlas Data Platform V3 on Vercel + Render

## Database (Neon recommended)

Render free Postgres can expire. Prefer **Neon**:

1. Create project at https://console.neon.tech  
2. Copy connection string (`postgresql://...`)  
3. Set as `DATABASE_URL` on Render  

## Render API

1. Push repo to GitHub.  
2. **New → Web Service**, root `backend`, start:  
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`  
3. Env secrets: `DATABASE_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `YOUTUBE_API_KEY`, `ADMIN_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS=https://YOUR.vercel.app`  
4. Optional worker service (Starter): `python -m app.worker_main` and set web `ENABLE_INLINE_WORKER=false`.

Or use `render.yaml` Blueprint (worker is optional/paid).

## Vercel frontend

1. Root directory: `frontend`  
2. Env: `VITE_API_URL=https://YOUR_API.onrender.com`  
3. Deploy  

Share pages work at `https://YOUR_VERCEL_APP/share/{run_id}` after enabling share on a completed run.

## UptimeRobot

Monitor `https://YOUR_API/health` every 5 minutes — uptime alerts and slightly warmer free instances.

## Verify

```bash
curl https://API/health
curl https://API/ready
curl https://API/api/research/preflight -H "Authorization: Bearer $TOKEN"
```
