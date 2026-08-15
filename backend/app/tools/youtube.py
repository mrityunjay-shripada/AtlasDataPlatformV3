"""YouTube Data API with Postgres cache, quota soft-stop, and search pagination."""
import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import YoutubeCache
from app.services import quota as quota_svc

logger = logging.getLogger(__name__)
BASE = "https://www.googleapis.com/youtube/v3"


class YouTubeQuotaExceeded(Exception):
    pass


def _parse_duration(iso: str) -> int:
    if not iso or not iso.startswith("PT"):
        return 0
    h = re.search(r"(\d+)H", iso)
    m = re.search(r"(\d+)M", iso)
    s = re.search(r"(\d+)S", iso)
    return (
        (int(h.group(1)) if h else 0) * 3600
        + (int(m.group(1)) if m else 0) * 60
        + (int(s.group(1)) if s else 0)
    )


def _key(endpoint: str, params: dict) -> str:
    raw = f"{endpoint}:{json.dumps(params, sort_keys=True)}"
    return hashlib.sha256(raw.encode()).hexdigest()


class YouTubeTool:
    def __init__(self, db: Session):
        self.db = db
        self.api_key = get_settings().youtube_api_key
        self.settings = get_settings()
        if not self.api_key:
            raise ValueError("YOUTUBE_API_KEY required")

    async def _get(self, endpoint: str, params: dict, units: int, ttl_hours: int = 24) -> dict:
        params_no_key = {**params}
        ck = _key(endpoint, params_no_key)
        row = self.db.query(YoutubeCache).filter_by(cache_key=ck).first()
        if row and (datetime.utcnow() - row.created_at).total_seconds() < ttl_hours * 3600:
            return row.payload

        if not quota_svc.can_spend_youtube(self.db, units):
            raise YouTubeQuotaExceeded(
                f"Soft quota stop: daily budget {self.settings.youtube_daily_unit_budget} reached"
            )

        params = {**params_no_key, "key": self.api_key}
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{BASE}/{endpoint}", params=params)
        if r.status_code == 403 and ("quotaExceeded" in r.text or "dailyLimitExceeded" in r.text):
            raise YouTubeQuotaExceeded("YouTube API quota exhausted (Google)")
        if r.status_code >= 400:
            raise RuntimeError(f"YouTube {r.status_code}: {r.text[:200]}")
        data = r.json()
        quota_svc.record_youtube(self.db, units)
        if row:
            row.payload = data
            row.created_at = datetime.utcnow()
            row.units_estimated = units
        else:
            self.db.add(YoutubeCache(cache_key=ck, payload=data, units_estimated=units))
        self.db.commit()
        return data

    async def search_page(
        self,
        query: str,
        max_results: int = 25,
        page_token: Optional[str] = None,
    ) -> Tuple[List[str], Optional[str]]:
        """Return (video_ids, next_page_token) for one search page."""
        params: dict = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": min(max_results, 50),
            "order": "viewCount",
            "videoDuration": "short",
            "relevanceLanguage": "en",
        }
        if page_token:
            params["pageToken"] = page_token
        data = await self._get("search", params, units=self.settings.youtube_search_units)
        ids = [
            it.get("id", {}).get("videoId")
            for it in data.get("items", [])
            if it.get("id", {}).get("videoId")
        ]
        return ids, data.get("nextPageToken")

    async def search(self, query: str, max_results: int = 25) -> List[str]:
        ids, _ = await self.search_page(query, max_results=max_results)
        return ids

    async def details(self, video_ids: List[str]) -> List[dict]:
        out = []
        for i in range(0, len(video_ids), 50):
            chunk = video_ids[i : i + 50]
            data = await self._get(
                "videos",
                {
                    "part": "snippet,statistics,contentDetails",
                    "id": ",".join(chunk),
                },
                units=self.settings.youtube_videos_units,
            )
            out.extend(data.get("items", []))
        return out

    def normalize(self, item: dict) -> dict:
        sn, st, cd = item.get("snippet", {}), item.get("statistics", {}), item.get("contentDetails", {})
        vid = item.get("id", "")
        desc = (sn.get("description") or "")[:4000]
        desc = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "[email]", desc)
        desc = re.sub(r"\+?\d[\d\s\-().]{8,}\d", "[phone]", desc)
        return {
            "youtube_id": vid,
            "title": sn.get("title") or "",
            "description": desc,
            "channel": sn.get("channelTitle") or "",
            "source_url": f"https://www.youtube.com/watch?v={vid}",
            "publish_date": sn.get("publishedAt"),
            "views": int(st.get("viewCount") or 0),
            "likes": int(st.get("likeCount") or 0),
            "comments": int(st.get("commentCount") or 0),
            "duration_seconds": _parse_duration(cd.get("duration", "")),
            "raw_meta": {"tags": (sn.get("tags") or [])[:15]},
        }

    async def collect(
        self,
        queries: List[str],
        target: int,
        page_tokens: Optional[Dict[str, Optional[str]]] = None,
        exclude_ids: Optional[Set[str]] = None,
        max_pages_per_query: int = 8,
    ) -> Tuple[List[dict], Dict[str, Optional[str]], Dict[str, int]]:
        """
        Collect up to `target` NEW normalized records.

        - page_tokens: per-query YouTube nextPageToken (None = start at page 1)
        - exclude_ids: already-known youtube_ids (this run / corpus)
        - Returns (records, updated_tokens, meta)
          updated_tokens[q] = next token or None if exhausted
          meta includes pages_fetched, skipped_dupes, queries_exhausted
        """
        seen: Set[str] = set(exclude_ids or set())
        records: List[dict] = []
        tokens: Dict[str, Optional[str]] = dict(page_tokens or {})
        defaults = queries or ["micro drama", "mini drama series", "short drama story"]
        pages_fetched = 0
        skipped_dupes = 0
        queries_exhausted = 0

        for q in defaults:
            if len(records) >= target:
                break
            # Empty string token means previously exhausted — skip
            if tokens.get(q) == "":
                queries_exhausted += 1
                continue

            pages = 0
            while len(records) < target and pages < max_pages_per_query:
                token = tokens.get(q)  # None on first page
                try:
                    ids, next_token = await self.search_page(q, max_results=25, page_token=token)
                    pages += 1
                    pages_fetched += 1
                except YouTubeQuotaExceeded:
                    raise
                except Exception as e:
                    logger.warning("search page failed q=%s token=%s: %s", q, token, e)
                    break

                if not ids:
                    tokens[q] = ""
                    queries_exhausted += 1
                    break

                new_ids = []
                for i in ids:
                    if i in seen:
                        skipped_dupes += 1
                        continue
                    seen.add(i)
                    new_ids.append(i)

                tokens[q] = next_token if next_token else ""

                if not new_ids:
                    if not next_token:
                        queries_exhausted += 1
                        break
                    continue

                try:
                    for item in await self.details(new_ids):
                        rec = self.normalize(item)
                        if rec["duration_seconds"] > 600:
                            continue
                        records.append(rec)
                        if len(records) >= target:
                            break
                except YouTubeQuotaExceeded:
                    raise
                except Exception as e:
                    logger.warning("details failed: %s", e)
                    break

                if not next_token:
                    queries_exhausted += 1
                    break

        meta = {
            "pages_fetched": pages_fetched,
            "skipped_dupes": skipped_dupes,
            "queries_exhausted": queries_exhausted,
            "new_records": len(records),
        }
        return records[:target], tokens, meta
