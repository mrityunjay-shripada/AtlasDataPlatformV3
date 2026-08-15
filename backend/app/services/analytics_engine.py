"""Phase 2 analytical engines — deterministic, claim-ready artifacts.

Engines: profile, patterns, performance, diagnostic, outliers, compare.
All numbers are sample-relative. No market opportunity language.
"""
from __future__ import annotations

import math
import statistics
from collections import Counter, defaultdict
from typing import Any


def build_profile(class_rows: list[dict], videos: list[dict]) -> dict[str, Any]:
    """Lightweight channel contribution to the research sample — not a creator suite."""
    by_channel: dict[str, dict[str, Any]] = {}
    for v in videos:
        ch = (v.get("channel") or "unknown").strip() or "unknown"
        slot = by_channel.setdefault(ch, {"channel": ch, "videos": 0, "views": 0, "genres": Counter()})
        slot["videos"] += 1
        slot["views"] += int(v.get("views") or 0)
    # attach genres from class_rows by youtube_id
    yt_genre = {c.get("youtube_id"): c.get("genre") for c in class_rows}
    for v in videos:
        ch = (v.get("channel") or "unknown").strip() or "unknown"
        g = yt_genre.get(v.get("youtube_id"))
        if g and ch in by_channel:
            by_channel[ch]["genres"][g] += 1
    channels = []
    for ch, slot in by_channel.items():
        channels.append({
            "channel": ch,
            "videos": slot["videos"],
            "views": slot["views"],
            "mean_views": slot["views"] / max(slot["videos"], 1),
            "top_genre": (slot["genres"].most_common(1)[0][0] if slot["genres"] else None),
            "genre_mix": dict(slot["genres"]),
        })
    channels.sort(key=lambda x: (-x["videos"], -x["views"]))
    return {
        "channel_count": len(channels),
        "channels": channels[:25],
        "note": "Channel contribution within this research sample only — not a full creator analytics product.",
    }


def build_patterns(class_rows: list[dict]) -> dict[str, Any]:
    genres = Counter(c.get("genre") or "unknown" for c in class_rows)
    tropes = Counter(c.get("trope") or "unknown" for c in class_rows)
    pairs = Counter()
    for c in class_rows:
        g = c.get("genre") or "unknown"
        t = c.get("trope") or "unknown"
        pairs[(g, t)] += 1
    total = max(len(class_rows), 1)
    co = [
        {"genre": g, "trope": t, "count": n, "share": round(n / total, 4)}
        for (g, t), n in pairs.most_common(20)
    ]
    return {
        "genre_distribution": dict(genres),
        "trope_distribution": dict(tropes.most_common(20)),
        "genre_trope_cooccurrence": co,
        "n_labeled": total,
    }


def build_performance(class_rows: list[dict], videos: list[dict]) -> dict[str, Any]:
    views = [int(v.get("views") or 0) for v in videos]
    likes = [int(v.get("likes") or 0) for v in videos]
    comments = [int(v.get("comments") or 0) for v in videos]
    durations = [int(v.get("duration_seconds") or 0) for v in videos if int(v.get("duration_seconds") or 0) > 0]

    def safe_mean(xs: list[float]) -> float:
        return sum(xs) / max(len(xs), 1)

    # per-video engagement proxy
    rows = []
    for v in videos:
        vw = int(v.get("views") or 0)
        lk = int(v.get("likes") or 0)
        cm = int(v.get("comments") or 0)
        eng = (lk + cm) / vw if vw > 0 else 0.0
        rows.append({
            "youtube_id": v.get("youtube_id"),
            "title": v.get("title"),
            "channel": v.get("channel"),
            "views": vw,
            "likes": lk,
            "comments": cm,
            "engagement_proxy": round(eng, 6),
            "duration_seconds": int(v.get("duration_seconds") or 0),
        })
    rows.sort(key=lambda x: -x["views"])

    # genre performance
    by_g: dict[str, list[int]] = defaultdict(list)
    yt_g = {c.get("youtube_id"): c.get("genre") for c in class_rows}
    for v in videos:
        g = yt_g.get(v.get("youtube_id")) or "unknown"
        by_g[g].append(int(v.get("views") or 0))
    genre_perf = [
        {"genre": g, "n": len(vs), "mean_views": safe_mean(vs), "max_views": max(vs) if vs else 0}
        for g, vs in by_g.items()
    ]
    genre_perf.sort(key=lambda x: -x["mean_views"])

    return {
        "summary": {
            "n": len(views),
            "mean_views": safe_mean(views),
            "median_views": statistics.median(views) if views else 0,
            "max_views": max(views) if views else 0,
            "mean_likes": safe_mean(likes),
            "mean_comments": safe_mean(comments),
            "mean_duration_seconds": safe_mean(durations) if durations else 0,
            "mean_engagement_proxy": safe_mean([r["engagement_proxy"] for r in rows]),
        },
        "genre_performance": genre_perf,
        "top_by_views": rows[:10],
        "top_by_engagement_proxy": sorted(rows, key=lambda x: -x["engagement_proxy"])[:10],
        "note": "Engagement proxy = (likes+comments)/views within this sample only.",
    }


def build_diagnostic(class_rows: list[dict], videos: list[dict], analysis: dict) -> dict[str, Any]:
    flags = []
    n = len(videos)
    n_lab = len(class_rows)
    low_conf = [c for c in class_rows if float(c.get("confidence") or 0) < 0.5]
    if n < 20:
        flags.append({
            "code": "small_sample",
            "severity": "info",
            "message": f"Sample size n={n} is small; treat saturation and gaps as sample signals only.",
        })
    if n_lab and len(low_conf) / max(n_lab, 1) >= 0.25:
        flags.append({
            "code": "low_confidence_share",
            "severity": "warn",
            "message": f"{len(low_conf)}/{n_lab} classifications below 0.5 confidence.",
        })
    genres = analysis.get("genre_distribution") or {}
    total = sum(int(v) for v in genres.values()) or 1
    if genres:
        top_g, top_n = max(genres.items(), key=lambda x: int(x[1]))
        share = int(top_n) / total
        if share >= 0.4:
            flags.append({
                "code": "concentration",
                "severity": "info",
                "message": f"Top genre '{top_g}' is {share:.0%} of labeled rows — high concentration in this pull.",
            })
    views = [int(v.get("views") or 0) for v in videos]
    if views and max(views) > 0 and statistics.mean(views) > 0:
        if max(views) / statistics.mean(views) >= 10:
            flags.append({
                "code": "view_skew",
                "severity": "info",
                "message": "View counts are highly skewed (max ≥ 10× mean); means can mislead.",
            })
    zeros = [g for g, c in (genres or {}).items() if int(c) == 0]
    # also known gaps from whitespace notes
    if analysis.get("whitespace_opportunities"):
        flags.append({
            "code": "underrepresentation_signals",
            "severity": "info",
            "message": f"{len(analysis['whitespace_opportunities'])} underrepresentation signal(s) in sample.",
        })
    if not flags:
        flags.append({
            "code": "ok",
            "severity": "info",
            "message": "No major diagnostic flags for this sample.",
        })
    return {"flags": flags, "n": n, "n_labeled": n_lab, "low_confidence_count": len(low_conf)}


def build_outliers(videos: list[dict], class_rows: list[dict]) -> dict[str, Any]:
    """Robust-ish outliers on views within sample (modified z-score on log1p views)."""
    if len(videos) < 5:
        return {"outliers": [], "note": "Need at least 5 videos for outlier detection.", "n": len(videos)}

    yt_meta = {c.get("youtube_id"): c for c in class_rows}
    rows = []
    for v in videos:
        vw = int(v.get("views") or 0)
        rows.append({
            "youtube_id": v.get("youtube_id"),
            "title": v.get("title"),
            "channel": v.get("channel"),
            "views": vw,
            "log_views": math.log1p(vw),
            "genre": (yt_meta.get(v.get("youtube_id")) or {}).get("genre"),
        })
    logs = [r["log_views"] for r in rows]
    med = statistics.median(logs)
    abs_dev = [abs(x - med) for x in logs]
    mad = statistics.median(abs_dev) or 1e-9
    outliers = []
    for r in rows:
        mz = 0.6745 * (r["log_views"] - med) / mad
        r["modified_z"] = round(mz, 3)
        if abs(mz) >= 3.0:
            outliers.append({**r, "direction": "high" if mz > 0 else "low"})
    outliers.sort(key=lambda x: -abs(x["modified_z"]))
    return {
        "method": "modified_z_log1p_views",
        "threshold": 3.0,
        "n": len(rows),
        "outliers": outliers[:15],
        "note": "Outliers are relative to this sample only.",
    }


def build_compare_payload(run_a: dict, run_b: dict, analysis_a: dict, analysis_b: dict) -> dict[str, Any]:
    ga = analysis_a.get("genre_distribution") or {}
    gb = analysis_b.get("genre_distribution") or {}
    keys = sorted(set(ga) | set(gb))
    total_a = sum(int(v) for v in ga.values()) or 1
    total_b = sum(int(v) for v in gb.values()) or 1
    genre_delta = []
    for k in keys:
        a_n, b_n = int(ga.get(k, 0)), int(gb.get(k, 0))
        a_s, b_s = a_n / total_a, b_n / total_b
        genre_delta.append({
            "genre": k,
            "count_a": a_n,
            "count_b": b_n,
            "share_a": round(a_s, 4),
            "share_b": round(b_s, 4),
            "share_delta": round(b_s - a_s, 4),
            "count_delta": b_n - a_n,
        })
    genre_delta.sort(key=lambda x: -abs(x["share_delta"]))

    pa = (analysis_a.get("performance") or {}).get("summary") or analysis_a.get("engagement_stats") or {}
    pb = (analysis_b.get("performance") or {}).get("summary") or analysis_b.get("engagement_stats") or {}

    return {
        "run_a": run_a,
        "run_b": run_b,
        "genre_delta": genre_delta,
        "performance_delta": {
            "mean_views_a": pa.get("mean_views"),
            "mean_views_b": pb.get("mean_views"),
            "mean_engagement_proxy_a": pa.get("mean_engagement_proxy"),
            "mean_engagement_proxy_b": pb.get("mean_engagement_proxy"),
        },
        "trope_a": analysis_a.get("trope_distribution"),
        "trope_b": analysis_b.get("trope_distribution"),
        "diagnostic_a": (analysis_a.get("diagnostic") or {}).get("flags"),
        "diagnostic_b": (analysis_b.get("diagnostic") or {}).get("flags"),
        "note": "Comparative descriptive stats across two runs — not causal.",
    }


def enrich_analysis(class_rows: list[dict], videos: list[dict], base: dict) -> dict[str, Any]:
    """Merge Phase 2–3 engines into analysis_json."""
    patterns = build_patterns(class_rows)
    profile = build_profile(class_rows, videos)
    performance = build_performance(class_rows, videos)
    diagnostic = build_diagnostic(class_rows, videos, base)
    outliers = build_outliers(videos, class_rows)
    out = dict(base)
    out["patterns"] = patterns
    out["profile"] = profile
    out["performance"] = performance
    out["diagnostic"] = diagnostic
    out["outliers"] = outliers
    out["exploratory"] = build_exploratory(class_rows, videos)
    out["proximity"] = build_proximity(class_rows, videos)
    out["potential"] = build_potential(class_rows, videos, out)
    # keep legacy engagement_stats in sync
    out["engagement_stats"] = {
        "count": performance["summary"]["n"],
        "mean_views": performance["summary"]["mean_views"],
        "max_views": performance["summary"]["max_views"],
        "median_views": performance["summary"]["median_views"],
        "mean_engagement_proxy": performance["summary"]["mean_engagement_proxy"],
    }
    return out


def build_exploratory(class_rows: list[dict], videos: list[dict]) -> dict[str, Any]:
    """Guided slices of the dataset for open investigation (sample-only)."""
    yt_c = {c.get("youtube_id"): c for c in class_rows}
    # duration buckets
    buckets = {"0-60s": 0, "60-180s": 0, "180-600s": 0, "600s+": 0, "unknown": 0}
    view_bands = {"<10k": 0, "10k-100k": 0, "100k-1M": 0, "1M+": 0}
    emotion = Counter()
    hook = Counter()
    for v in videos:
        d = int(v.get("duration_seconds") or 0)
        if d <= 0:
            buckets["unknown"] += 1
        elif d <= 60:
            buckets["0-60s"] += 1
        elif d <= 180:
            buckets["60-180s"] += 1
        elif d <= 600:
            buckets["180-600s"] += 1
        else:
            buckets["600s+"] += 1
        vw = int(v.get("views") or 0)
        if vw < 10_000:
            view_bands["<10k"] += 1
        elif vw < 100_000:
            view_bands["10k-100k"] += 1
        elif vw < 1_000_000:
            view_bands["100k-1M"] += 1
        else:
            view_bands["1M+"] += 1
        c = yt_c.get(v.get("youtube_id")) or {}
        if c.get("emotion"):
            emotion[c["emotion"]] += 1
        if c.get("hook"):
            hook[c["hook"]] += 1
    return {
        "duration_buckets": buckets,
        "view_bands": view_bands,
        "emotion_distribution": dict(emotion.most_common(12)),
        "hook_distribution": dict(hook.most_common(12)),
        "n": len(videos),
        "note": "Exploratory slices of this sample — filters for investigation, not market segments.",
    }


def _tokenize(text: str) -> set[str]:
    import re
    return {t for t in re.findall(r"[a-z0-9]{3,}", (text or "").lower()) if t not in {
        "the", "and", "for", "with", "from", "this", "that", "you", "your", "are", "was", "video", "shorts"
    }}


def build_proximity(class_rows: list[dict], videos: list[dict], top_k: int = 5) -> dict[str, Any]:
    """Small-start proximity: shared genre/trope + title/description token Jaccard."""
    yt_c = {c.get("youtube_id"): c for c in class_rows}
    items = []
    for v in videos:
        c = yt_c.get(v.get("youtube_id")) or {}
        text = f"{v.get('title') or ''} {v.get('description') or ''}"
        items.append({
            "youtube_id": v.get("youtube_id"),
            "title": v.get("title"),
            "channel": v.get("channel"),
            "genre": c.get("genre"),
            "trope": c.get("trope"),
            "tokens": _tokenize(text),
            "views": int(v.get("views") or 0),
        })
    pairs = []
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            a, b = items[i], items[j]
            inter = len(a["tokens"] & b["tokens"])
            union = len(a["tokens"] | b["tokens"]) or 1
            jacc = inter / union
            tax = 0.0
            if a.get("genre") and a.get("genre") == b.get("genre"):
                tax += 0.35
            if a.get("trope") and a.get("trope") == b.get("trope") and str(a.get("trope")).lower() not in ("unknown", "other"):
                tax += 0.35
            score = round(min(1.0, jacc + tax), 4)
            if score < 0.2:
                continue
            pairs.append({
                "a": a["youtube_id"],
                "b": b["youtube_id"],
                "title_a": a["title"],
                "title_b": b["title"],
                "score": score,
                "shared_genre": a.get("genre") if a.get("genre") == b.get("genre") else None,
                "shared_trope": a.get("trope") if a.get("trope") == b.get("trope") else None,
                "token_jaccard": round(jacc, 4),
            })
    pairs.sort(key=lambda x: -x["score"])
    # nearest neighbors per video
    neighbors: dict[str, list] = defaultdict(list)
    for p in pairs:
        neighbors[p["a"]].append({"youtube_id": p["b"], "title": p["title_b"], "score": p["score"]})
        neighbors[p["b"]].append({"youtube_id": p["a"], "title": p["title_a"], "score": p["score"]})
    for k in neighbors:
        neighbors[k] = sorted(neighbors[k], key=lambda x: -x["score"])[:top_k]
    return {
        "method": "taxonomy_boost + title/description token Jaccard",
        "pair_count": len(pairs),
        "top_pairs": pairs[:15],
        "neighbors": dict(list(neighbors.items())[:30]),
        "note": "Proximity within this sample only — not a global YouTube graph.",
    }


def build_potential(class_rows: list[dict], videos: list[dict], analysis: dict) -> dict[str, Any]:
    """Signal vs Potential — never silent Opportunity.

    Signal: underrepresented in sample (zero/low count in taxonomy).
    Potential: Signal + supporting performance evidence in related peers (e.g. high engagement in adjacent genres).
    """
    genres = Counter(c.get("genre") or "unknown" for c in class_rows)
    tropes = Counter(c.get("trope") or "unknown" for c in class_rows)
    total = max(len(class_rows), 1)
    perf = (analysis.get("performance") or {}).get("genre_performance") or []
    mean_by_g = {p["genre"]: p.get("mean_views") or 0 for p in perf}
    overall_mean = statistics.mean(mean_by_g.values()) if mean_by_g else 0

    known = ["mystery", "supernatural", "thriller", "tragedy", "slice_of_life", "comedy", "family", "revenge"]
    signals = []
    for g in known:
        cnt = int(genres.get(g, 0))
        if cnt == 0:
            signals.append({
                "kind": "genre",
                "key": g,
                "count": 0,
                "share": 0.0,
                "level": "signal",
                "statement": f"Signal: genre '{g}' is underrepresented in the observed sample (0 of {total}).",
            })
        elif cnt / total <= 0.05 and cnt <= 2:
            signals.append({
                "kind": "genre",
                "key": g,
                "count": cnt,
                "share": round(cnt / total, 4),
                "level": "signal",
                "statement": f"Signal: genre '{g}' is thin in sample ({cnt} of {total}).",
            })

    # Potential: signal genres where adjacent high-performing genres exist (weak support only)
    potentials = []
    for s in signals:
        if s["count"] != 0:
            continue
        # supporting evidence: sample has strong mean views overall or in romance/comedy etc.
        support = []
        if overall_mean >= 100_000:
            support.append(f"Sample mean views are elevated ({round(overall_mean):,}) — demand exists for some micro-dramas in this pull.")
        for g, mv in sorted(mean_by_g.items(), key=lambda x: -x[1])[:3]:
            if mv >= overall_mean and mv > 0:
                support.append(f"Peer genre '{g}' mean views={round(mv):,} in this sample.")
        if support:
            potentials.append({
                **s,
                "level": "potential",
                "statement": (
                    f"Potential: '{s['key']}' is absent in sample while peer performance signals exist. "
                    f"Not a market opportunity claim."
                ),
                "support": support[:3],
            })

    return {
        "signals": signals,
        "potentials": potentials,
        "n": total,
        "language_rules": {
            "signal": "Underrepresented in the observed sample",
            "potential": "Signal + supporting performance evidence in-sample",
            "opportunity": "Not emitted by default",
        },
        "note": "Potential is not Opportunity. Methodology must explicitly allow stronger claims.",
    }
