#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from modules.config import load_config
from modules.scraper import GoogleReviewsScraper
from modules.review_db import ReviewDB


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--place-id", required=True)
    parser.add_argument("--place-name", required=True)
    parser.add_argument("--url", required=True)
    args = parser.parse_args()

    config = load_config()
    config["url"] = args.url
    config["headless"] = True
    config["scrape_mode"] = "full"

    scraper = GoogleReviewsScraper(config)
    try:
        success = scraper.scrape()
        if not success:
            raise RuntimeError("Python scraper failed")

        db = ReviewDB(config.get("db_path", "reviews.db"))
        try:
            current_url = getattr(getattr(scraper, "config", {}), "get", None)
            place = None
            candidates = [args.place_id]
            if callable(current_url):
                candidates.extend(
                    [
                        getattr(scraper, "config", {}).get("url"),
                    ]
                )
            for candidate in filter(None, [args.place_id, getattr(scraper, "last_place_id", None)]):
                place = db.get_place(candidate)
                if place:
                    args.place_id = candidate
                    break
            if not place:
                stats = db.get_stats().get("places", [])
                if not stats:
                    raise RuntimeError("Không tìm thấy place trong SQLite sau khi crawl")
                best = max(stats, key=lambda row: row.get("last_scraped") or "")
                args.place_id = best.get("place_id", args.place_id)
                place = db.get_place(args.place_id)

            rows = db.get_reviews(args.place_id)
        finally:
            db.close()

        reviews = []
        for row in rows:
            text_map = row.get("review_text", {}) if isinstance(row.get("review_text"), dict) else {}
            text = text_map.get("vi") or text_map.get("en") or next(iter(text_map.values()), "") if text_map else ""
            reviews.append({
                "reviewId": row.get("review_id"),
                "authorName": row.get("author"),
                "authorThumbnail": row.get("profile_picture"),
                "rating": row.get("rating", 0),
                "text": text,
                "isoDate": row.get("review_date") or None,
                "rawDate": row.get("raw_date") or None,
                "likes": row.get("likes", 0),
            })

        print(json.dumps({
            "placeId": args.place_id,
            "placeName": place.get("place_name") or args.place_name,
            "officialTotalReviews": place.get("official_total_reviews", len(reviews)),
            "officialAvgRating": place.get("official_avg_rating", 0),
            "reviews": reviews,
        }, ensure_ascii=False))
    finally:
        scraper.review_db.close()


if __name__ == "__main__":
    main()
