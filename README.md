# Atlas Data Platform V3

**YouTube Research & Intelligence Command Center**

```
Question → Methodology → Collect → Analyze → Claims → Evidence → Ask Atlas → Memory → Monitor
```

## What it does

Atlas turns a natural-language research question into a reproducible YouTube research study:

1. Plan search queries (Gemini)
2. Collect videos (YouTube Data API + pagination)
3. Classify (Groq) with cache
4. Deterministic analytics (patterns, performance, diagnostic, outliers, proximity, potential)
5. Emit **claims** with evidence links to videos
6. Interpret with Gemini report
7. Ask Atlas (metrics / claims / methodology / memory / run-to-run)
8. Prescriptive next steps bound to claim IDs
9. Pulse / Refresh / Monitor and gated predictive trajectories

## Stack

| Layer | Stack |
|-------|--------|
| Frontend | React, Vite, TypeScript, Tailwind → Vercel |
| Backend | FastAPI → Render |
| Database | Neon PostgreSQL |
| LLM | Gemini · Groq |
| Source | YouTube Data API v3 |

## Modules

- **Research** — Study, methodology, collect, runs  
- **Analyze** — Profile, patterns, performance, diagnostic, compare, outliers, exploratory, proximity, potential  
- **Intelligence** — Ask Atlas, prescriptive, predictive  
- **Proof** — Claims, evidence, limitations  
- **Memory** — Research memory, run-to-run, pulse, refresh, monitor  

## Principle

Sample statistics are computed in code (`count / n`). Language models do not invent percentages. Findings resolve to **Claim → Evidence → Video → YouTube**.

## Deploy

See `docs/DEPLOY_VERCEL_RENDER.md` and `render.yaml`.

```bash
curl https://YOUR-API.onrender.com/health
# {"status":"ok","service":"atlasdataplatform-v3","version":"3.0.0"}
```

## Version

**3.0.0** — Atlas Data Platform V3
