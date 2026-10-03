from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from skillscope.demo_data import PUBLIC_FIELDS, build_demo_snapshot, strip_record


class DemoSnapshotTests(unittest.TestCase):
    def test_public_record_drops_identity_and_vacancy_text(self) -> None:
        record = {
            "market": "kg",
            "review_decision": "included",
            "role_family": "data_analyst",
            "skills_normalized": ["SQL"],
            "vacancy_id": "private-id",
            "title": "Private vacancy title",
            "employer": "Private company",
            "description_text": "Private vacancy description",
        }

        public_record = strip_record(record)

        self.assertEqual(set(public_record), set(PUBLIC_FIELDS))
        self.assertNotIn("vacancy_id", public_record)
        self.assertNotIn("title", public_record)
        self.assertNotIn("employer", public_record)
        self.assertNotIn("description_text", public_record)

    def test_builds_demo_snapshot_with_aggregate_denominators(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "source.jsonl"
            output = root / "demo" / "snapshot.jsonl"
            source.write_text(
                json.dumps(
                    {
                        "market": "uz",
                        "review_decision": "included",
                        "role_family": "bi_analyst",
                        "skills_normalized": ["SQL", "Power BI"],
                        "vacancy_id": "private-id",
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            candidates, included = build_demo_snapshot(source, output)
            public_record = json.loads(output.read_text(encoding="utf-8"))

            self.assertEqual((candidates, included), (1, 1))
            self.assertEqual(public_record["skills_normalized"], ["SQL", "Power BI"])
            self.assertNotIn("vacancy_id", public_record)


if __name__ == "__main__":
    unittest.main()
