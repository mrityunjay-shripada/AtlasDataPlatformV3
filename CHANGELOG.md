## 3.0.8

- Fix Vercel build: export missing `LineageFilter` type from ui.tsx

## 3.0.7

- Predictive/Pulse: count Next-batch **snapshots** as observations (not only run rows)
- Record observation snapshot on each successful run completion
- Fix misleading copy that implied Next batch alone unlocked predictive without snapshots
- Honest message when pre-snapshot batches cannot be reconstructed

## 3.0.6

- Fix Vercel build: remove orphan `</details>` in Insights JSX

## 3.0.5

- Sticky research context bar
- Proximity thumbnails (YouTube hqdefault)
- Potential signal matrix (sample-only labels)

## 3.0.4

- Pattern row → inspect drawer (Why / Evidence / Ask)
- Outlier breakout cards
- Key findings: Why? · Evidence · Ask Atlas

## 3.0.3

- Analyze workspace tabs (one pane)
- Rename Open → Underrepresented (+ not market validation)
- Key Findings / signals remain top band

## 3.0.2

- Beta Insights UX: Key signals strip, lean frame, Analyze/Prescriptive collapsed by default, Predictive lock card (80/20 visual bias)

# Changelog

## 3.0.1

- Pink-error fix: `GET /api/research/quota` + soft `getQuota()` (no NetworkError banner on quota miss)

## 3.0.0 — Atlas Data Platform V3

- Research Study, Methodology, Corpus
- Claims and Evidence proof backbone
- Analyze engines (profile through potential)
- Ask Atlas, research memory, run-to-run
- Pulse, Refresh, Monitor
- Prescriptive recommendations bound to claims
- Predictive layer with insufficient-data gating
