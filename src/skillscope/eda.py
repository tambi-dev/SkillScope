"""Create a stratified validation sample and first descriptive EDA outputs."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
from collections import Counter, defaultdict
from datetime import UTC, datetime
from itertools import combinations
from pathlib import Path
from statistics import median
from typing import Any

from skillscope.config import Settings

LOGGER = logging.getLogger("skillscope.eda")
REVIEW_FIELDS = (
    "human_core_decision",
    "human_role_family",
    "human_seniority",
    "review_notes",
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/processed/vacancies_latest.jsonl"),
        help="Processed JSONL dataset",
    )
    parser.add_argument(
        "--sample-per-stratum",
        type=int,
        default=1,
        help="Maximum included vacancies sampled per country-role-seniority stratum",
    )
    args = parser.parse_args()
    if args.sample_per_stratum < 1:
        parser.error("--sample-per-stratum must be positive")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = Settings.from_environment()
    input_path = args.input if args.input.is_absolute() else settings.project_root / args.input
    try:
        records = _read_jsonl(input_path)
    except (OSError, ValueError) as error:
        parser.error(str(error))

    output_dir = settings.project_root / "artifacts" / "reports"
    output_dir.mkdir(parents=True, exist_ok=True)
    processed_dir = settings.project_root / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    sample_path = processed_dir / "validation_sample_latest.csv"
    selected = build_validation_sample(records, sample_per_stratum=args.sample_per_stratum)
    selected = preserve_reviewed_records(selected, records, sample_path)
    write_validation_sample(sample_path, selected)

    report = build_eda_report(records, source_path=input_path)
    report_path = output_dir / "eda_latest.json"
    _write_json(report_path, report)
    _write_skill_csv(output_dir / "skills_by_market.csv", report["skills_by_market"])
    _write_skill_csv(output_dir / "skills_by_role.csv", report["skills_by_role"])
    _write_salary_csv(output_dir / "salary_summary.csv", report["salary_summary"])

    LOGGER.info(
        "EDA complete: %s records; validation sample has %s rows",
        report["dataset"]["included_vacancies"],
        len(selected),
    )
    print(report_path)
    print(sample_path)


def build_validation_sample(
    records: list[dict[str, Any]], *, sample_per_stratum: int = 2
) -> list[dict[str, Any]]:
    """Select reproducible included strata and all current excluded rows."""

    included_groups: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    excluded: list[dict[str, Any]] = []
    for record in records:
        if record.get("review_decision") == "included":
            key = (
                str(record.get("market") or "unknown"),
                str(record.get("role_family") or "unknown"),
                str(record.get("seniority") or "Unknown"),
            )
            included_groups[key].append(record)
        elif record.get("review_decision") == "excluded":
            excluded.append(record)

    selected: list[dict[str, Any]] = []
    for group_key in sorted(included_groups):
        group = sorted(
            included_groups[group_key],
            key=lambda record: _stable_rank(record),
        )
        selected.extend(group[:sample_per_stratum])
    selected.extend(sorted(excluded, key=_stable_rank))
    return selected


def preserve_reviewed_records(
    selected: list[dict[str, Any]], records: list[dict[str, Any]], path: Path
) -> list[dict[str, Any]]:
    """Keep previously reviewed records even when updated strata select new rows."""

    reviews = _read_existing_reviews(path)
    reviewed_keys = {
        key
        for key, review in reviews.items()
        if any(str(review.get(field, "")).strip() for field in REVIEW_FIELDS)
    }
    selected_keys = {
        (str(record.get("market", "")), str(record.get("vacancy_id", "")))
        for record in selected
    }
    records_by_key = {
        (str(record.get("market", "")), str(record.get("vacancy_id", ""))): record
        for record in records
    }
    selected.extend(
        records_by_key[key]
        for key in sorted(reviewed_keys - selected_keys)
        if key in records_by_key
    )
    return selected


def write_validation_sample(path: Path, records: list[dict[str, Any]]) -> None:
    existing_reviews = _read_existing_reviews(path)
    fieldnames = (
        "market",
        "vacancy_id",
        "title",
        "vacancy_url",
        "model_decision",
        "model_role_family",
        "model_seniority",
        "seniority_confidence",
        "seniority_reasons",
        "experience_band",
        "skills",
        *REVIEW_FIELDS,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            key = (str(record.get("market", "")), str(record.get("vacancy_id", "")))
            previous = existing_reviews.get(key, {})
            writer.writerow(
                {
                    "market": record.get("market"),
                    "vacancy_id": record.get("vacancy_id"),
                    "title": record.get("title"),
                    "vacancy_url": record.get("alternate_url"),
                    "model_decision": record.get("review_decision"),
                    "model_role_family": record.get("role_family") or "",
                    "model_seniority": record.get("seniority") or "Unknown",
                    "seniority_confidence": record.get("seniority_confidence"),
                    "seniority_reasons": ";".join(record.get("seniority_reasons", [])),
                    "experience_band": record.get("experience") or "",
                    "skills": "; ".join(record.get("skills_normalized", [])),
                    **{field: previous.get(field, "") for field in REVIEW_FIELDS},
                }
            )
    temporary.replace(path)


def build_eda_report(
    records: list[dict[str, Any]], *, source_path: Path
) -> dict[str, Any]:
    included = [record for record in records if record.get("review_decision") == "included"]
    markets = sorted({str(record.get("market") or "unknown") for record in included})
    included_by_market = {
        market: [record for record in included if record.get("market") == market]
        for market in markets
    }
    salaries_by_market: dict[str, list[dict[str, Any]]] = {
        market: [record for record in group if _has_salary(record)]
        for market, group in included_by_market.items()
    }
    skill_market_rows = _skill_frequency_rows(included, "market")
    skill_role_rows = _skill_frequency_rows(included, "role_family")
    salary_rows = _salary_summary_rows(included)
    return {
        "schema_version": 1,
        "created_at": datetime.now(UTC).isoformat(),
        "source_file": source_path.name,
        "dataset": {
            "candidate_vacancies": len(records),
            "included_vacancies": len(included),
            "excluded_candidates": sum(
                record.get("review_decision") == "excluded" for record in records
            ),
            "markets": markets,
            "role_counts": _counts(included, "role_family"),
            "seniority_counts": _counts(included, "seniority"),
            "seniority_confidence_counts": _counts(included, "seniority_confidence"),
            "salary_coverage_by_market": {
                market: {
                    "with_reported_salary": len(salaries_by_market[market]),
                    "included_vacancies": len(included_by_market[market]),
                    "coverage": _ratio(
                        len(salaries_by_market[market]), len(included_by_market[market])
                    ),
                }
                for market in markets
            },
        },
        "skills_by_market": skill_market_rows,
        "skills_by_role": skill_role_rows,
        "skill_cooccurrence": _skill_cooccurrence(included),
        "salary_summary": salary_rows,
        "interpretation_limits": [
            "One snapshot describes vacancies returned by the configured HeadHunter search; "
            "it is not a labour-market census.",
            "Skill frequencies are based on explicit vacancy text and key skills; "
            "missing mentions do not prove a skill is not required.",
            "Salary summaries use reported values and local currencies; "
            "currencies are not pooled across countries.",
            "Small salary groups are descriptive only and do not support reliable inference "
            "or salary prediction.",
            "Seniority may be inferred from experience bands and is not always employer-declared.",
            "The role and seniority rules have not yet been independently human-validated.",
        ],
    }


def _skill_frequency_rows(
    records: list[dict[str, Any]], group_field: str
) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        group = str(record.get(group_field) or "Unknown")
        groups[group].append(record)
    rows: list[dict[str, Any]] = []
    for group, group_records in sorted(groups.items()):
        counts = Counter(
            skill
            for record in group_records
            for skill in set(record.get("skills_normalized", []))
        )
        for skill, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
            rows.append(
                {
                    "group": group,
                    "skill": skill,
                    "vacancies_with_skill": count,
                    "vacancy_denominator": len(group_records),
                    "share": round(count / len(group_records), 4),
                }
            )
    return rows


def _skill_cooccurrence(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    pair_counts: Counter[tuple[str, str]] = Counter()
    for record in records:
        skills = sorted(set(record.get("skills_normalized", [])))
        pair_counts.update(combinations(skills, 2))
    return [
        {"skill_a": pair[0], "skill_b": pair[1], "vacancies_together": count}
        for pair, count in sorted(pair_counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def _salary_summary_rows(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str, str], list[float]] = defaultdict(list)
    for record in records:
        value = record.get("salary_midpoint_local")
        if isinstance(value, int | float) and not isinstance(value, bool):
            key = (
                str(record.get("market") or "unknown"),
                str(record.get("salary_currency") or "unknown"),
                str(record.get("role_family") or "unknown"),
            )
            groups[key].append(float(value))
    return [
        {
            "market": market,
            "currency": currency,
            "role_family": role,
            "complete_salary_ranges": len(values),
            "median_midpoint_local": median(values),
        }
        for (market, currency, role), values in sorted(groups.items())
    ]


def _counts(records: list[dict[str, Any]], field: str) -> dict[str, int]:
    return dict(sorted(Counter(str(record.get(field) or "Unknown") for record in records).items()))


def _has_salary(record: dict[str, Any]) -> bool:
    return record.get("salary_from") is not None or record.get("salary_to") is not None


def _ratio(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 4) if denominator else None


def _stable_rank(record: dict[str, Any]) -> str:
    sample_key = f"{record.get('market')}:{record.get('vacancy_id')}"
    return hashlib.sha256(sample_key.encode("utf-8")).hexdigest()


def _read_existing_reviews(path: Path) -> dict[tuple[str, str], dict[str, str]]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames or not set(REVIEW_FIELDS).issubset(reader.fieldnames):
            return {}
        return {
            (str(row.get("market", "")), str(row.get("vacancy_id", ""))): row
            for row in reader
        }


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise ValueError(f"Processed dataset not found: {path}")
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"Invalid JSON on line {line_number}: {error}") from error
        if not isinstance(payload, dict):
            raise ValueError(f"Expected object on line {line_number}")
        records.append(payload)
    return records


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    temporary.replace(path)


def _write_skill_csv(path: Path, records: list[dict[str, Any]]) -> None:
    _write_csv(
        path,
        ("group", "skill", "vacancies_with_skill", "vacancy_denominator", "share"),
        records,
    )


def _write_salary_csv(path: Path, records: list[dict[str, Any]]) -> None:
    _write_csv(
        path,
        ("market", "currency", "role_family", "complete_salary_ranges", "median_midpoint_local"),
        records,
    )


def _write_csv(path: Path, fieldnames: tuple[str, ...], records: list[dict[str, Any]]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    temporary.replace(path)


if __name__ == "__main__":
    main()
