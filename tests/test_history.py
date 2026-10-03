from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from skillscope.history import update_history


class HistoryTests(unittest.TestCase):
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
        }
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "history.sqlite3"
            first_update, first_lifecycle = update_history(
                database_path=database_path,
                collection_id="run-1",
                observed_at="2026-09-25T00:00:00+00:00",
                records=[record],
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


if __name__ == "__main__":
    unittest.main()
