from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from skillscope.history import update_history


class HistoryTests(unittest.TestCase):
    def test_reprocessing_replaces_observations_and_removes_orphans(self) -> None:
        record = {
            "market": "kg", "vacancy_id": "123", "title": "Data Analyst",
            "employer": None, "role_family": "data_analyst", "seniority": "Middle",
            "published_at": "2026-09-01", "archived": False,
            "salary_from": None, "salary_to": None, "salary_currency": None,
        }
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "history.sqlite3"
            update_history(
                database_path=database_path, collection_id="run-1",
                observed_at="2026-09-25", records=[record], market_counts={"kg": (1, 1)},
            )
            update_history(
                database_path=database_path, collection_id="run-2",
                observed_at="2026-10-02", records=[record, {**record, "vacancy_id": "456"}],
                market_counts={"kg": (2, 2)},
            )
            update, lifecycle = update_history(
                database_path=database_path, collection_id="run-2",
                observed_at="2026-10-02", records=[], market_counts={"kg": (2, 0)},
            )
            with closing(sqlite3.connect(database_path)) as connection:
                self.assertEqual(
                    connection.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 1
                )
                self.assertEqual(
                    connection.execute("SELECT vacancy_id, first_seen_at, last_seen_at "
                                       "FROM vacancies").fetchall(),
                    [("123", "2026-09-25", "2026-09-25")],
                )
                self.assertEqual(
                    connection.execute("SELECT candidates, included FROM collection_markets "
                                       "WHERE collection_id = 'run-2'").fetchone(),
                    (2, 0),
                )
            self.assertEqual(update.total_tracked, 1)
            self.assertEqual(lifecycle, {})

    def test_updates_lifecycle_without_duplicate_observations(self) -> None:
        record = {
            "market": "kg",
            "vacancy_id": "123",
            "title": "Data Analyst",
            "employer": "Example",
            "role_family": "data_analyst",
            "seniority": "Middle",
            "published_at": "2026-09-01T00:00:00+03:00",
            "archived": False,
            "salary_from": 40_000,
            "salary_to": 60_000,
            "salary_currency": "KGS",
            "role_category": "data_ai",
            "experience": "between1And3",
            "salary_midpoint_local": 50_000,
            "skills_normalized": ["SQL", "Python"],
        }
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "history.sqlite3"
            first_update, first_lifecycle = update_history(
                database_path=database_path,
                collection_id="run-1",
                observed_at="2026-09-25T00:00:00+00:00",
                records=[record],
                market_counts={"kg": (2, 1), "tj": (0, 0)},
            )
            repeated_update, repeated_lifecycle = update_history(
                database_path=database_path,
                collection_id="run-1",
                observed_at="2026-09-25T00:00:00+00:00",
                records=[record],
            )
            second_update, second_lifecycle = update_history(
                database_path=database_path,
                collection_id="run-2",
                observed_at="2026-10-02T00:00:00+00:00",
                records=[record],
            )
            with closing(sqlite3.connect(database_path)) as connection:
                row = connection.execute(
                    "SELECT published_at, observed_at, role_category, experience, "
                    "salary_midpoint_local, skills_normalized FROM observations "
                    "WHERE collection_id = 'run-2'"
                ).fetchone()
                self.assertIsNotNone(row)
                self.assertEqual(row[:5], (
                    record["published_at"], "2026-10-02T00:00:00+00:00", "data_ai",
                    "between1And3", 50_000,
                ))
                self.assertEqual(json.loads(row[5]), ["SQL", "Python"])
                self.assertEqual(
                    connection.execute("SELECT COUNT(*) FROM collections").fetchone()[0], 2
                )
                self.assertEqual(
                    connection.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 2
                )
                self.assertEqual(
                    connection.execute(
                        "SELECT candidates, included FROM collection_markets "
                        "WHERE collection_id = 'run-1' AND market = 'tj'"
                    ).fetchone(),
                    (0, 0),
                )

        key = ("kg", "123")
        self.assertEqual(first_update.new_vacancies, 1)
        self.assertEqual(first_lifecycle[key]["observation_count"], 1)
        self.assertEqual(repeated_update.new_vacancies, 0)
        self.assertEqual(repeated_lifecycle[key]["observation_count"], 1)
        self.assertEqual(second_update.existing_vacancies, 1)
        self.assertEqual(second_lifecycle[key]["observation_count"], 2)
        self.assertEqual(
            second_lifecycle[key]["last_seen_at"],
            "2026-10-02T00:00:00+00:00",
        )

    def test_migrates_existing_history_without_losing_observations(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "history.sqlite3"
            with closing(sqlite3.connect(database_path)) as connection:
                connection.executescript("""
                    CREATE TABLE vacancies (
                        market TEXT NOT NULL, vacancy_id TEXT NOT NULL,
                        first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
                        title TEXT NOT NULL, employer TEXT, role_family TEXT,
                        seniority TEXT NOT NULL, published_at TEXT, archived INTEGER NOT NULL,
                        PRIMARY KEY (market, vacancy_id)
                    );
                    CREATE TABLE observations (
                        collection_id TEXT NOT NULL, observed_at TEXT NOT NULL,
                        market TEXT NOT NULL, vacancy_id TEXT NOT NULL, title TEXT NOT NULL,
                        role_family TEXT, seniority TEXT NOT NULL, salary_from REAL,
                        salary_to REAL, salary_currency TEXT, archived INTEGER NOT NULL,
                        PRIMARY KEY (collection_id, market, vacancy_id)
                    );
                    INSERT INTO vacancies VALUES
                        ('kg', '123', '2026-09-25', '2026-09-25', 'Data Analyst',
                         NULL, 'data_analyst', 'Middle', '2026-09-01', 0);
                    INSERT INTO observations VALUES
                        ('old-run', '2026-09-25', 'kg', '123', 'Data Analyst',
                         'data_analyst', 'Middle', 40000, 60000, 'KGS', 0);
                    PRAGMA user_version = 1;
                """)
            record = {
                "market": "kg", "vacancy_id": "123", "title": "Data Analyst",
                "employer": None, "role_family": "data_analyst", "seniority": "Middle",
                "published_at": "2026-09-01", "archived": False,
                "salary_from": 40_000, "salary_to": 60_000, "salary_currency": "KGS",
                "skills_normalized": ["SQL"],
            }
            _, lifecycle = update_history(
                database_path=database_path, collection_id="new-run",
                observed_at="2026-10-02", records=[record],
            )
            with closing(sqlite3.connect(database_path)) as connection:
                self.assertEqual(connection.execute("PRAGMA user_version").fetchone()[0], 2)
                self.assertEqual(
                    connection.execute("SELECT COUNT(*) FROM collections").fetchone()[0], 2
                )
                self.assertEqual(
                    connection.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 2
                )
                self.assertIsNone(connection.execute(
                    "SELECT skills_normalized FROM observations WHERE collection_id = 'old-run'"
                ).fetchone()[0])
            self.assertEqual(lifecycle[("kg", "123")]["observation_count"], 2)


if __name__ == "__main__":
    unittest.main()
