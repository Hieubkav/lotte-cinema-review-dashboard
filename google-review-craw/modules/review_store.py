from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Set


class ReviewStore(ABC):
    @abstractmethod
    def register_place(
        self,
        place_id: str,
        place_name: str,
        original_url: str,
        resolved_url: str = "",
        lat: float | None = None,
        lng: float | None = None,
    ) -> str:
        raise NotImplementedError

    @abstractmethod
    def start_session(self, place_id: str, sort_by: str | None = None) -> Optional[str]:
        raise NotImplementedError

    @abstractmethod
    def get_seen_ids(self, place_id: str) -> Set[str]:
        raise NotImplementedError

    def get_review_ids(self, place_id: str) -> Set[str]:
        return self.get_seen_ids(place_id)

    @abstractmethod
    def upsert_reviews_batch(
        self,
        place_id: str,
        batch: List[Dict[str, Any]],
        session_id: str | None = None,
        scrape_mode: str = "update",
    ) -> Dict[str, int]:
        raise NotImplementedError

    @abstractmethod
    def end_session(
        self,
        session_id: str | None,
        status: str,
        reviews_found: int = 0,
        reviews_new: int = 0,
        reviews_updated: int = 0,
        error: str | None = None,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
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
        raise NotImplementedError

    @abstractmethod
    def get_place(self, place_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def get_reviews(self, place_id: str, limit: int | None = None) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def close(self) -> None:
        raise NotImplementedError
