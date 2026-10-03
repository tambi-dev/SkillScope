from __future__ import annotations

import unittest

from skillscope.collect import _market_summary


class CollectionReportTests(unittest.TestCase):
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
