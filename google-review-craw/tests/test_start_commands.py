"""Tests for start.py command dispatch and management commands."""

import json
import pytest
from pathlib import Path
from unittest.mock import patch

from modules.review_db import ReviewDB


def _make_db(tmp_path, reviews=None):
    """Create a test DB and optionally populate it."""
    db_path = str(tmp_path / "test.db")
    db = ReviewDB(db_path)
    if reviews:
        db.upsert_place("place1", "Test Place", "http://test")
        for r in reviews:
            db.upsert_review("place1", r)
    return db, db_path


def _make_review(rid="r1", text="Great!", rating=5.0):
    return {
        "review_id": rid, "text": text, "rating": rating,
        "likes": 1, "lang": "en", "date": "3 months ago",
        "review_date": "2025-06-15", "author": "Test",
        "profile": "", "avatar": "", "owner_text": "", "photos": [],
    }


class TestExportCommand:
    """Tests for the export command."""

    def test_export_json(self, tmp_path):
        db, db_path = _make_db(tmp_path, [_make_review("r1"), _make_review("r2")])
        db.close()

        output_path = str(tmp_path / "export.json")
        from start import _run_export, _get_db_path
        from types import SimpleNamespace

        args = SimpleNamespace(
            db_path=db_path, config=None,
            format="json", place_id="place1",
            output=output_path, include_deleted=False,
        )
        _run_export({}, args)

        data = json.loads(Path(output_path).read_text())
        assert len(data) == 2

    def test_export_csv(self, tmp_path):
        db, db_path = _make_db(tmp_path, [_make_review("r1")])
        db.close()

        output_path = str(tmp_path / "export.csv")
        from start import _run_export
        from types import SimpleNamespace

        args = SimpleNamespace(
            db_path=db_path, config=None,
            format="csv", place_id="place1",
            output=output_path, include_deleted=False,
        )
        _run_export({}, args)
        assert Path(output_path).exists()


class TestDbStatsCommand:
    """Tests for the db-stats command."""

    def test_shows_stats(self, tmp_path, capsys):
        db, db_path = _make_db(tmp_path, [_make_review("r1")])
        db.close()

        from start import _run_db_stats
        from types import SimpleNamespace
        args = SimpleNamespace(db_path=db_path, config=None)
        _run_db_stats({}, args)

        output = capsys.readouterr().out
        assert "Reviews:" in output
        assert "Places:" in output


class TestClearCommand:
    """Tests for the clear command."""

    def test_clear_place(self, tmp_path):
        db, db_path = _make_db(tmp_path, [_make_review("r1")])
        db.close()

        from start import _run_clear
        from types import SimpleNamespace
        args = SimpleNamespace(
            db_path=db_path, config=None,
            place_id="place1", confirm=True,
        )
        _run_clear({}, args)

        db = ReviewDB(db_path)
        try:
            assert db.get_reviews("place1") == []
        finally:
            db.close()


class TestHideRestoreCommands:
    """Tests for hide and restore commands."""

    def test_hide_and_restore(self, tmp_path, capsys):
        db, db_path = _make_db(tmp_path, [_make_review("r1")])
        db.close()

        from start import _run_hide, _run_restore
        from types import SimpleNamespace

        args = SimpleNamespace(
            db_path=db_path, config=None,
            review_id="r1", place_id="place1",
        )

        _run_hide({}, args)
        output = capsys.readouterr().out
        assert "hidden" in output

        _run_restore({}, args)
        output = capsys.readouterr().out
        assert "restored" in output


class TestPruneHistoryCommand:
    """Tests for prune-history command."""

    def test_prune_dry_run(self, tmp_path, capsys):
        db, db_path = _make_db(tmp_path, [_make_review("r1")])
        db.close()

        from start import _run_prune_history
        from types import SimpleNamespace
        args = SimpleNamespace(
            db_path=db_path, config=None,
            older_than=0, dry_run=True,
        )
        _run_prune_history({}, args)
        output = capsys.readouterr().out
        assert "Would prune" in output


class TestSyncStatusCommand:
    """Tests for sync-status command."""

    def test_no_checkpoints(self, tmp_path, capsys):
        db, db_path = _make_db(tmp_path)
        db.close()

        from start import _run_sync_status
        from types import SimpleNamespace
        args = SimpleNamespace(db_path=db_path, config=None)
        _run_sync_status({}, args)
        output = capsys.readouterr().out
        assert "No sync checkpoints" in output


class TestInteractiveBusinessSelection:
    """Tests for interactive scrape selection."""

    def test_filter_businesses_for_query(self):
        from start import _filter_businesses_for_query

        businesses = [
            {"url": "https://example.com/a", "custom_params": {"company": "LOTTE Cinema Moonlight", "placeId": "p1"}},
            {"url": "https://example.com/b", "custom_params": {"company": "LOTTE Cinema West Lake", "placeId": "p2"}},
        ]

        matches = _filter_businesses_for_query(businesses, "west")
        assert len(matches) == 1
        assert matches[0][1]["custom_params"]["placeId"] == "p2"

    def test_prompt_sync_businesses_all(self):
        from start import _prompt_sync_businesses

        businesses = [
            {"url": "https://example.com/a", "custom_params": {"company": "A"}},
            {"url": "https://example.com/b", "custom_params": {"company": "B"}},
        ]

        with patch("builtins.input", side_effect=["a"]):
            selected = _prompt_sync_businesses(businesses)

        assert selected == businesses

    def test_prompt_sync_businesses_single(self):
        from start import _prompt_sync_businesses

        businesses = [
            {"url": "https://example.com/a", "custom_params": {"company": "Moonlight", "placeId": "p1"}},
            {"url": "https://example.com/b", "custom_params": {"company": "West Lake", "placeId": "p2"}},
        ]

        with patch("builtins.input", side_effect=["o", "west", "1"]):
            selected = _prompt_sync_businesses(businesses)

        assert selected == [businesses[1]]


class TestConvexSyncHelpers:
    def test_build_metrics_payload(self):
        from start import _build_metrics_payload

        reviews = [
            {"rating": 5, "review_date": "2026-04-10T00:00:00+00:00"},
            {"rating": 3, "review_date": "2026-01-01T00:00:00+00:00"},
        ]

        metrics = _build_metrics_payload(reviews, 4.2, 480)
        assert metrics["avgRating"] == 4.2
        assert metrics["totalReviews"] == 480
        assert metrics["capturedReviews"] == 2
        assert metrics["starDistribution"]["star5"] == 1
        assert metrics["starDistribution"]["star3"] == 1

    @patch("start.subprocess.run")
    def test_sync_place_to_convex_runs_required_mutations(self, mock_run, tmp_path):
        from start import _sync_place_to_convex

        mock_run.return_value.returncode = 0
        project_root = tmp_path / "lotte_gg_map"
        crawler_root = project_root / "google-review-craw"
        web_root = project_root / "online-reputation-management-system"
        scripts_dir = web_root / "scripts"
        scripts_dir.mkdir(parents=True)
        (web_root / ".env.local").write_text("NEXT_PUBLIC_CONVEX_URL=test\n", encoding="utf-8")
        (scripts_dir / "convex-run.js").write_text("// test", encoding="utf-8")
        fake_start = crawler_root / "start.py"
        fake_start.parent.mkdir(parents=True)
        fake_start.write_text("", encoding="utf-8")

        place_snapshot = {
            "place_id": "p1",
            "place_name": "Test Place",
            "original_url": "https://example.com",
            "resolved_url": "https://example.com",
            "latitude": None,
            "longitude": None,
            "last_scraped": "2026-04-18T00:00:00+00:00",
            "official_total_reviews": 10,
            "official_avg_rating": 4.5,
            "captured_total_reviews": 2,
        }
        reviews = [
            {"review_id": "r1", "author": "A", "profile_picture": "", "rating": 5, "review_text": {"vi": "Hay"}, "review_date": "2026-04-18T00:00:00+00:00", "raw_date": "today", "likes": 1},
            {"review_id": "r2", "author": "B", "profile_picture": "", "rating": 4, "review_text": {"en": "Good"}, "review_date": "2026-04-01T00:00:00+00:00", "raw_date": "week", "likes": 0},
        ]

        with patch("start.Path.resolve", return_value=fake_start):
            _sync_place_to_convex({}, place_snapshot, reviews)

        assert mock_run.call_count == 3
