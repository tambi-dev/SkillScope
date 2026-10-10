"""Create an identity-stripped snapshot that can be committed for public demos."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

PUBLIC_FIELDS = (
    "market",
    "review_decision",
    "role_family",
    "role_category",
    "experience",
    "seniority",
    "last_seen_at",
    "skills_normalized",
    "salary_from",
    "salary_to",
    "salary_midpoint_local",
    "salary_currency",
)


def strip_record(record: dict[str, Any]) -> dict[str, Any]:
    """Retain only fields needed for aggregate charts; discard vacancy identity/text."""

    return {field: record.get(field) for field in PUBLIC_FIELDS}


def build_demo_snapshot(source_path: Path, output_path: Path) -> tuple[int, int]:
    """Write a compact, identity-stripped JSONL copy and return candidate/included counts."""

    records = [
        json.loads(line)
        for line in source_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not records or any(not isinstance(record, dict) for record in records):
        raise ValueError(f"Expected a non-empty JSONL file of objects: {source_path}")

    safe_records = [strip_record(record) for record in records]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_suffix(output_path.suffix + ".tmp")
    temporary.write_text(
        "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in safe_records),
        encoding="utf-8",
    )
    temporary.replace(output_path)
    included = sum(record.get("review_decision") == "included" for record in records)
    return len(records), included


def main() -> None:
    project_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=project_root / "data" / "processed" / "vacancies_latest.jsonl",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).with_name("demo_vacancies.jsonl"),
    )
    args = parser.parse_args()
    candidates, included = build_demo_snapshot(args.source, args.output)
    print(f"Wrote {args.output}: {candidates} candidates, {included} included.")


if __name__ == "__main__":
    main()
