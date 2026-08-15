"""In-process metrics (exported via /metrics JSON). Good enough for single/small Render."""
from collections import defaultdict
from threading import Lock
from time import time

_lock = Lock()
_counters: dict[str, int] = defaultdict(int)
_timings: dict[str, list[float]] = defaultdict(list)

def incr(name: str, n: int = 1) -> None:
    with _lock:
        _counters[name] += n

def timing(name: str, ms: float) -> None:
    with _lock:
        arr = _timings[name]
        arr.append(ms)
        if len(arr) > 500:
            del arr[:250]

def snapshot() -> dict:
    with _lock:
        out = {"counters": dict(_counters), "timings_ms": {}}
        for k, vals in _timings.items():
            if not vals:
                continue
            s = sorted(vals)
            out["timings_ms"][k] = {
                "count": len(s),
                "p50": s[len(s)//2],
                "p95": s[int(len(s)*0.95)] if len(s) > 1 else s[0],
                "max": s[-1],
            }
        return out
