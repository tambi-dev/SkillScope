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
from skillscope.ingestion.hh_client import HHApiError, HHClient


class CollectionReportTests(unittest.TestCase):
    def test_reuses_unchanged_details_and_fetches_new_or_changed_vacancies(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config").mkdir()
            project_root = Path(__file__).resolve().parents[1]
            shutil.copyfile(
                project_root / "config" / "skills.toml", root / "config" / "skills.toml"
            )
            previous = root / "data" / "raw" / "20261005T000000000000Z" / "vacancies" / "kg"
            previous.mkdir(parents=True)

            def detail(vacancy_id: str, salary_from: int) -> dict:
                return {
                    "id": vacancy_id, "name": "Data Analyst", "description": "<p>SQL</p>",
                    "published_at": "2026-10-05T09:00:00+0300", "archived": False,
                    "salary": {"from": salary_from, "to": 300, "currency": "KGS", "gross": False},
                    "experience": {"id": "noExperience"},
                }

            for vacancy_id in ("100", "101"):
                (previous / f"{vacancy_id}.json").write_text(
                    json.dumps(detail(vacancy_id, 100)), encoding="utf-8"
                )

            collection_id = "20261012T000000000000Z"
            pages = (
                root / "data" / "raw" / collection_id / "search_pages"
                / "kg" / "data_analyst" / "data-analyst"
            )
            pages.mkdir(parents=True)
            pages.joinpath("page_000.json").write_text(json.dumps({
                "items": [
                    {
                        key: value
                        for key, value in detail(vacancy_id, salary_from).items()
                        if key != "description"
                    }
                    for vacancy_id, salary_from in (
                        ("100", 100), ("101", 200), ("102", 100), ("103", 100)
                    )
                ],
            }), encoding="utf-8")
            report_path = root / "audit.json"
            report_path.write_text(json.dumps({
                "collection_id": collection_id,
                "finished_at": "2026-10-12T00:00:00+00:00",
                "markets": [{"code": "kg"}],
                "search_mode": "strict",
            }), encoding="utf-8")
            client = Mock(spec=HHClient)
            def fetch(vacancy_id: str, host: str) -> dict:
                if vacancy_id == "103":
                    raise HHApiError("HH API returned HTTP 404", status_code=404)
                return detail(vacancy_id, 200 if vacancy_id == "101" else 100)
            client.get_vacancy.side_effect = fetch

            run_collection(
                settings=Settings.from_environment(root), client=client,
                markets=(Market("kg", "Kyrgyzstan", "headhunter.kg", "48", "KGS"),),
                audit_report_path=report_path,
            )

            self.assertEqual(
                {call.args[0] for call in client.get_vacancy.call_args_list}, {"101", "102", "103"}
            )
            reused = root / "data" / "raw" / collection_id / "vacancies" / "kg" / "100.json"
            self.assertEqual(json.loads(reused.read_text(encoding="utf-8"))["salary"]["from"], 100)
            latest = root / "data" / "processed" / "vacancies_latest.jsonl"
            self.assertEqual(len(latest.read_text(encoding="utf-8").splitlines()), 3)

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
