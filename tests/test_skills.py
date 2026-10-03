from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from skillscope.processing.skills import extract_skills, load_skill_definitions


class SkillExtractionTests(unittest.TestCase):
    def test_normalizes_aliases_and_retains_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "skills.toml"
            path.write_text(
                '[skills.postgresql]\nlabel = "PostgreSQL"\naliases = ["postgres", "postgresql"]\n'
                '[skills.scikit_learn]\nlabel = "scikit-learn"\naliases = ["sklearn"]\n',
                encoding="utf-8",
            )
            definitions = load_skill_definitions(path)

        evidence = extract_skills(
            title="Data Analyst",
            description="Модели на sklearn",
            key_skills=["Postgres"],
            definitions=definitions,
        )

        self.assertEqual(evidence["PostgreSQL"], ["key_skills"])
        self.assertEqual(evidence["scikit-learn"], ["description"])

    def test_sql_does_not_match_inside_postgresql(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "skills.toml"
            path.write_text(
                '[skills.sql]\nlabel = "SQL"\naliases = ["sql"]\n',
                encoding="utf-8",
            )
            definitions = load_skill_definitions(path)

        evidence = extract_skills(
            title="PostgreSQL developer",
            description="",
            key_skills=[],
            definitions=definitions,
        )

        self.assertEqual(evidence, {})


if __name__ == "__main__":
    unittest.main()
