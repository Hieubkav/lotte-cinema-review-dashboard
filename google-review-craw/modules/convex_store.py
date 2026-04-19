from __future__ import annotations

import json
import logging
import subprocess
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from modules.review_store import ReviewStore

log = logging.getLogger("scraper")


class ConvexReviewStore(ReviewStore):
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.project_root = Path(__file__).resolve().parents[2]
        self.web_root = self.project_root.parent / "online-reputation-management-system"
        self.node_path = config.get("convex", {}).get("node_path") or "C:\\Program Files\\nodejs\\node.exe"
        self.runner_path = self.web_root / "scripts" / "convex-run.js"
        self.env_path = self.web_root / ".env.local"
        self.place_cache: Dict[str, Dict[str, Any]] = {}
        self._validate_runtime()

    def _validate_runtime(self) -> None:
        if not self.web_root.exists():
            raise RuntimeError(f"Không tìm thấy web app Convex: {self.web_root}")
        if not self.env_path.exists():
            raise RuntimeError(f"Thiếu file Convex env: {self.env_path}")
        if not self.runner_path.exists():
            raise RuntimeError(f"Thiếu Convex runner: {self.runner_path}")

    def _run_convex(self, function_name: str, payload: Dict[str, Any]) -> Any:
        command = [self.node_path, str(self.runner_path), function_name, json.dumps(payload, ensure_ascii=False)]
        result = subprocess.run(
            command,
            cwd=str(self.web_root),
            check=False,
            text=True,
            capture_output=True,
            shell=False,
        )
        if result.returncode != 0:
            message = (result.stderr or result.stdout or "").strip()
            raise RuntimeError(f"Convex call failed: {function_name}" + (f" - {message}" if message else ""))

        output = (result.stdout or "").strip()
        if not output:
            return None

        last_line = output.splitlines()[-1].strip()
        try:
            return json.loads(last_line)
        except json.JSONDecodeError:
            return last_line

    @staticmethod
    def _review_to_convex(review: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "reviewId": review.get("review_id") or review.get("reviewId") or "",
            "authorName": review.get("author") or review.get("authorName") or "",
            "authorThumbnail": review.get("avatar") or review.get("profile_picture") or review.get("authorThumbnail") or "",
            "rating": float(review.get("rating") or 0),
            "text": review.get("text") or "",
            "isoDate": review.get("review_date") or review.get("isoDate") or None,
            "rawDate": review.get("date") or review.get("raw_date") or review.get("rawDate") or None,
            "likes": int(review.get("likes") or 0),
        }

    @staticmethod
    def _convex_review_to_legacy(review: Dict[str, Any]) -> Dict[str, Any]:
        text = review.get("text") or ""
        return {
            "review_id": review.get("reviewId", ""),
            "place_id": review.get("placeId", ""),
            "author": review.get("authorName", ""),
            "rating": review.get("rating", 0),
            "review_text": {"vi": text} if text else {},
            "raw_date": review.get("rawDate", ""),
            "review_date": review.get("isoDate", ""),
            "likes": review.get("likes", 0),
            "user_images": [],
            "profile_url": "",
            "profile_picture": review.get("authorThumbnail", ""),
            "owner_responses": {},
            "created_date": review.get("createdAt", ""),
            "last_modified": review.get("updatedAt", ""),
        }

    def register_place(
        self,
        place_id: str,
        place_name: str,
        original_url: str,
        resolved_url: str = "",
        lat: float | None = None,
        lng: float | None = None,
    ) -> str:
        existing = self.get_place(place_id) or {}
        payload = {
            "placeId": place_id,
            "name": place_name or existing.get("name") or place_id,
            "originalUrl": original_url or existing.get("originalUrl"),
            "resolvedUrl": resolved_url or existing.get("resolvedUrl"),
            "latitude": lat,
            "longitude": lng,
            "officialTotalReviews": int(existing.get("officialTotalReviews") or 0),
            "officialAvgRating": float(existing.get("officialAvgRating") or 0),
            "capturedTotalReviews": int(existing.get("capturedTotalReviews") or 0),
            "lastScrapedAt": existing.get("lastScrapedAt"),
            "lastSyncStatus": existing.get("lastSyncStatus"),
            "lastSyncError": existing.get("lastSyncError"),
        }
        self._run_convex("places:upsert", payload)
        self.place_cache[place_id] = payload
        return place_id

    def start_session(self, place_id: str, sort_by: str | None = None) -> Optional[str]:
        job_id = str(uuid.uuid4())
        place = self.get_place(place_id) or {}
        payload = {
            "jobId": job_id,
            "placeId": place_id,
            "placeName": place.get("name") or place_id,
            "url": place.get("resolvedUrl") or place.get("originalUrl") or self.config.get("url", ""),
            "officialOnly": False,
            "message": f"Scrape started ({sort_by or self.config.get('sort_by', 'newest')})",
        }
        self._run_convex("crawlJobs:create", payload)
        self._run_convex("crawlJobs:setStatus", {
            "jobId": job_id,
            "status": "running",
            "message": "Scraping reviews",
        })
        return job_id

    def get_seen_ids(self, place_id: str) -> Set[str]:
        rows = self._run_convex("reviews:paginatedByPlace", {
            "placeId": place_id,
            "page": 1,
            "limit": 200,
        }) or {}
        total_pages = int(rows.get("totalPages") or 0)
        reviews = list(rows.get("reviews") or [])
        for page in range(2, total_pages + 1):
            page_rows = self._run_convex("reviews:paginatedByPlace", {
                "placeId": place_id,
                "page": page,
                "limit": 200,
            }) or {}
            reviews.extend(page_rows.get("reviews") or [])
        return {row.get("reviewId") for row in reviews if row.get("reviewId")}

    def upsert_reviews_batch(
        self,
        place_id: str,
        batch: List[Dict[str, Any]],
        session_id: str | None = None,
        scrape_mode: str = "update",
    ) -> Dict[str, int]:
        if not batch:
            return {"new": 0, "updated": 0, "restored": 0, "unchanged": 0}

        rows = [self._review_to_convex(review) for review in batch if review.get("review_id")]
        result = self._run_convex("reviews:upsertManyForPlace", {
            "placeId": place_id,
            "reviews": rows,
        }) or {}

        if session_id:
            self._run_convex("crawlJobs:addEvent", {
                "jobId": session_id,
                "level": "info",
                "message": f"Batch synced: {len(rows)} reviews",
            })

        return {
            "new": int(result.get("inserted") or 0),
            "updated": int(result.get("updated") or 0),
            "restored": 0,
            "unchanged": int(result.get("unchanged") or 0),
        }

    def end_session(
        self,
        session_id: str | None,
        status: str,
        reviews_found: int = 0,
        reviews_new: int = 0,
        reviews_updated: int = 0,
        error: str | None = None,
    ) -> None:
        if not session_id:
            return
        status_map = {
            "completed": "completed",
            "failed": "failed",
            "cancelled": "cancelled",
            "running": "running",
            "queued": "queued",
        }
        self._run_convex("crawlJobs:setStatus", {
            "jobId": session_id,
            "status": status_map.get(status, "failed"),
            "message": f"Found {reviews_found} reviews, new {reviews_new}, updated {reviews_updated}",
            "error": error,
            "reviewsSynced": reviews_found,
        })

    def update_place_snapshot(
        self,
        place_id: str,
        *,
        official_total_reviews: int | None = None,
        official_avg_rating: float | None = None,
        captured_total_reviews: int | None = None,
        last_sync_status: str | None = None,
        last_sync_error: str | None = None,
    ) -> None:
        place = self.get_place(place_id) or {"placeId": place_id, "name": place_id}
        payload = {
            "placeId": place_id,
            "name": place.get("name") or place_id,
            "originalUrl": place.get("originalUrl"),
            "resolvedUrl": place.get("resolvedUrl"),
            "latitude": place.get("latitude"),
            "longitude": place.get("longitude"),
            "officialTotalReviews": int(official_total_reviews if official_total_reviews is not None else place.get("officialTotalReviews") or 0),
            "officialAvgRating": float(official_avg_rating if official_avg_rating is not None else place.get("officialAvgRating") or 0),
            "capturedTotalReviews": int(captured_total_reviews if captured_total_reviews is not None else place.get("capturedTotalReviews") or 0),
            "lastScrapedAt": place.get("lastScrapedAt"),
            "lastSyncStatus": last_sync_status if last_sync_status is not None else place.get("lastSyncStatus"),
            "lastSyncError": last_sync_error if last_sync_error is not None else place.get("lastSyncError"),
        }
        self._run_convex("places:upsert", payload)
        self.place_cache[place_id] = payload

    def get_place(self, place_id: str) -> Optional[Dict[str, Any]]:
        if place_id in self.place_cache:
            return self.place_cache[place_id]
        place = self._run_convex("places:getByPlaceId", {"placeId": place_id})
        if isinstance(place, dict):
            self.place_cache[place_id] = place
        return place

    def get_reviews(self, place_id: str, limit: int | None = None) -> List[Dict[str, Any]]:
        page_limit = min(int(limit or 200), 200)
        rows = self._run_convex("reviews:paginatedByPlace", {
            "placeId": place_id,
            "page": 1,
            "limit": page_limit,
        }) or {}
        reviews = list(rows.get("reviews") or [])
        total_pages = int(rows.get("totalPages") or 0)
        if limit is None:
            for page in range(2, total_pages + 1):
                page_rows = self._run_convex("reviews:paginatedByPlace", {
                    "placeId": place_id,
                    "page": page,
                    "limit": 200,
                }) or {}
                reviews.extend(page_rows.get("reviews") or [])
        return [self._convex_review_to_legacy(review) for review in reviews]

    def close(self) -> None:
        return None
