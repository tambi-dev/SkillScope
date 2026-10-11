from __future__ import annotations

import json
import shutil
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import Mock

from skillscope.collect import _market_summary, run_collection
from skillscope.config import Market, Settings
from skillscope.ingestion.hh_client import HHClient


class CollectionReportTests(unittest.TestCase):
    def test_empty_market_run_is_retained_without_replacing_latest_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_dir = root / "config"
            config_dir.mkdir()
            project_root = Path(__file__).resolve().parents[1]
            shutil.copyfile(project_root / "config" / "skills.toml", config_dir / "skills.toml")
            report_path = root / "audit.json"
            report_path.write_text(json.dumps({
                "collection_id": "20261010T000000Z",
                "finished_at": "2026-10-10T00:00:00+00:00",
                "markets": [{"code": "tm"}],
                "search_mode": "strict",
            }), encoding="utf-8")
            latest = root / "data" / "processed" / "vacancies_latest.jsonl"
            latest.parent.mkdir(parents=True)
            latest.write_text("existing snapshot\n", encoding="utf-8")
            market = Market("tm", "Turkmenistan", "hh.ru", "93", "TMT")

            result_path = run_collection(
                settings=Settings.from_environment(root),
                client=Mock(spec=HHClient),
                markets=(market,),
                audit_report_path=report_path,
            )

            result = json.loads(result_path.read_text(encoding="utf-8"))
            self.assertIsNone(result["outputs"]["processed_jsonl"])
            self.assertEqual(latest.read_text(encoding="utf-8"), "existing snapshot\n")
            snapshot = root / result["outputs"]["snapshot_jsonl"]
            self.assertEqual(snapshot.read_text(encoding="utf-8"), "")
            with closing(sqlite3.connect(root / result["outputs"]["history_database"])) as db:
                self.assertEqual(
                    db.execute("SELECT candidates, included FROM collection_markets").fetchone(),
                    (0, 0),
                )

    def test_market_summary_keeps_countries_separate(self) -> None:
        records = [
            {
                "market": "kg",
                "review_decision": "included",
                "role_family": "data_analyst",
                "seniority": "Middle",
                "salary_from": 40_000,
                "salary_to": 60_000,
            },
            {
                "market": "kz",
                "review_decision": "included",
                "role_family": "ml_engineer",
                "seniority": "Senior",
                "salary_from": None,
                "salary_to": None,
            },
            {
                "market": "kz",
                "review_decision": "excluded",
                "role_family": None,
                "seniority": "Unknown",
                "salary_from": 1,
                "salary_to": 2,
            },
        ]

        summary = _market_summary(records)

        self.assertEqual(summary[0]["market"], "kg")
        self.assertEqual(summary[0]["salary_coverage"], 1.0)
        self.assertEqual(summary[1]["candidates"], 2)
        self.assertEqual(summary[1]["included"], 1)
        self.assertEqual(summary[1]["salary_coverage"], 0.0)


if __name__ == "__main__":
    unittest.main()
