from __future__ import annotations

import unittest

from skillscope.processing.seniority import classify_seniority


class SeniorityClassificationTests(unittest.TestCase):
    def test_title_has_priority_over_experience(self) -> None:
        result = classify_seniority(
            title="Junior Data Analyst",
            experience_id="between3And6",
        )

        self.assertEqual(result.seniority, "Junior")
        self.assertEqual(result.confidence, "high")

    def test_ambiguous_experience_band_does_not_imply_senior(self) -> None:
        result = classify_seniority(
            title="Data Scientist",
            experience_id="between3And6",
        )

        self.assertEqual(result.seniority, "Unknown")
        self.assertIn("experience_3_to_6_ambiguous", result.reason_codes)

    def test_uses_contextual_description_level(self) -> None:
        result = classify_seniority(
            title="ML Engineer",
            experience_id="between1And3",
            description="Позиция: middle. Работа с моделями.",
        )

        self.assertEqual(result.seniority, "Middle")
        self.assertIn("explicit_description_seniority", result.reason_codes)

    def test_conflicting_title_is_unknown(self) -> None:
        result = classify_seniority(
            title="Middle / Senior Data Scientist",
            experience_id="between3And6",
        )

        self.assertEqual(result.seniority, "Unknown")
        self.assertIn("conflicting_title_seniority", result.reason_codes)

    def test_missing_evidence_is_unknown(self) -> None:
        result = classify_seniority(title="Data Analyst", experience_id=None)

        self.assertEqual(result.seniority, "Unknown")


if __name__ == "__main__":
    unittest.main()
