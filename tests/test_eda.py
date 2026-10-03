from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from skillscope.eda import preserve_reviewed_records


class ValidationSampleTests(unittest.TestCase):
    def test_preserves_reviewed_records_outside_new_strata_sample(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "validation.csv"
            with path.open("w", encoding="utf-8-sig", newline="") as target:
                writer = csv.DictWriter(
                    target,
                    fieldnames=(
                        "market",
                        "vacancy_id",
                        "human_core_decision",
                        "human_role_family",
                        "human_seniority",
                        "review_notes",
                    ),
                )
                writer.writeheader()
                writer.writerow(
                    {
                        "market": "kg",
                        "vacancy_id": "reviewed-1",
                        "human_core_decision": "yes",
                    }
                )

            selected = [{"market": "kz", "vacancy_id": "new-sample"}]
            records = [
                {"market": "kg", "vacancy_id": "reviewed-1"},
                {"market": "kz", "vacancy_id": "new-sample"},
            ]

            result = preserve_reviewed_records(selected, records, path)

        self.assertEqual(
            {(row["market"], row["vacancy_id"]) for row in result},
            {("kg", "reviewed-1"), ("kz", "new-sample")},
        )


if __name__ == "__main__":
    unittest.main()
