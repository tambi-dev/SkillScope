from __future__ import annotations

import unittest
from datetime import UTC, datetime

from skillscope.audit import build_report, slugify
from skillscope.config import Market, RoleQueries


class AuditTests(unittest.TestCase):
    def test_report_deduplicates_overlapping_queries(self) -> None:
        market = Market("kg", "Kyrgyzstan", "headhunter.kg", "48", "KGS")
        role = RoleQueries("data_analyst", "Data Analyst", ("data analyst",))
        records = [
            {
                "id": "1",
                "salary": {"from": 50_000},
                "_audit_market": "kg",
                "_audit_role": "data_analyst",
            },
            {
                "id": "1",
                "salary": {"from": 50_000},
                "_audit_market": "kg",
                "_audit_role": "data_analyst",
            },
            {
                "id": "2",
                "salary": None,
                "_audit_market": "kg",
                "_audit_role": "data_analyst",
            },
        ]
        now = datetime.now(UTC)

        report = build_report(
            collection_id="test",
            started_at=now,
            finished_at=now,
            markets=(market,),
            roles=(role,),
            query_results=[],
            records=records,
            authenticated=True,
        )

        self.assertEqual(report["overall"]["unique_candidates"], 2)
        self.assertEqual(report["overall"]["salary_coverage"], 0.5)
        self.assertEqual(report["role_summary"][0]["with_salary"], 1)

    def test_slugify_is_stable_for_non_ascii_query(self) -> None:
        first = slugify("аналитик данных")
        second = slugify("аналитик данных")

        self.assertEqual(first, second)
        self.assertEqual(len(first), 12)


if __name__ == "__main__":
    unittest.main()

