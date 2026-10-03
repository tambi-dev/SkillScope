from __future__ import annotations

import unittest

from skillscope.processing.salary import normalize_salary


class SalaryNormalizationTests(unittest.TestCase):
    def test_calculates_midpoint_for_complete_kgs_range(self) -> None:
        result = normalize_salary(40_000, 70_000, "KGS", "KGS")

        self.assertEqual(result.midpoint_local, 55_000)
        self.assertEqual(result.status, "complete_range")

    def test_does_not_invent_missing_range_bound(self) -> None:
        result = normalize_salary(50_000, None, "KGS", "KGS")

        self.assertIsNone(result.midpoint_local)
        self.assertEqual(result.status, "one_sided_range")

    def test_flags_currency_mismatch(self) -> None:
        result = normalize_salary(1_000, 2_000, "USD", "KGS")

        self.assertIsNone(result.midpoint_local)
        self.assertEqual(result.status, "currency_mismatch")


if __name__ == "__main__":
    unittest.main()
