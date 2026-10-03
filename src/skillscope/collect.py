"""Fetch full vacancy details and create a reviewable processed dataset."""

from __future__ import annotations

import argparse
import csv
import json
import logging
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from skillscope.config import Market, Settings, load_markets
from skillscope.history import HistoryUpdate, update_history
from skillscope.ingestion.hh_client import HHApiError, HHClient
from skillscope.processing.roles import classify_role, strip_html
from skillscope.processing.salary import normalize_salary
from skillscope.processing.seniority import classify_seniority
from skillscope.processing.skills import (
    SkillDefinition,
    extract_skills,
    load_skill_definitions,
)

LOGGER = logging.getLogger("skillscope.collect")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--market",
        action="append",
        help="Configured market code; repeat to select markets (default: all enabled)",
    )
    parser.add_argument(
        "--source-report",
        type=Path,
        default=Path("artifacts/reports/feasibility_latest.json"),
        help="Feasibility report whose raw candidate pages should be enriched",
    )
    parser.add_argument(
        "--refresh-details",
        action="store_true",
        help="Fetch details again instead of reusing this audit's raw snapshots",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = Settings.from_environment()
    markets_path = settings.project_root / "config" / "markets.toml"
    markets = {market.code: market for market in load_markets(markets_path)}
    selected_codes = set(args.market or markets)
    missing_codes = selected_codes - markets.keys()
    if missing_codes:
        parser.error(f"Unknown or disabled market codes: {', '.join(sorted(missing_codes))}")
    selected_markets = tuple(
        market for code, market in markets.items() if code in selected_codes
    )
    client = HHClient(
        user_agent=settings.hh_user_agent,
        access_token=settings.hh_access_token,
        timeout_seconds=settings.request_timeout_seconds,
        max_retries=settings.max_retries,
    )
    try:
        report_path = run_collection(
            settings=settings,
            client=client,
            markets=selected_markets,
            refresh_details=args.refresh_details,
            audit_report_path=(
                args.source_report
                if args.source_report.is_absolute()
                else settings.project_root / args.source_report
            ),
        )
    except (HHApiError, OSError, ValueError) as error:
        LOGGER.error("Collection failed: %s", error)
        raise SystemExit(1) from error
    print(report_path)


def run_collection(
    *,
    settings: Settings,
    client: HHClient,
    markets: tuple[Market, ...],
    refresh_details: bool = False,
    audit_report_path: Path | None = None,
) -> Path:
    audit_report_path = audit_report_path or (
        settings.project_root / "artifacts" / "reports" / "feasibility_latest.json"
    )
    audit_report = _read_json(audit_report_path)
    search_mode = str(audit_report.get("search_mode") or "strict")
    if search_mode not in {"strict", "broad"}:
        raise ValueError(f"Unsupported search mode in {audit_report_path}: {search_mode}")
    output_suffix = "" if search_mode == "strict" else "_broad"
    collection_id = str(audit_report.get("collection_id", ""))
    if not collection_id:
        raise ValueError("The feasibility report has no collection_id; run the audit first")

    source_dir = settings.project_root / "data" / "raw" / collection_id
    details_dir = source_dir / "vacancies"
    skills_path = settings.project_root / "config" / "skills.toml"
    skill_definitions = load_skill_definitions(skills_path)
    records: list[dict[str, Any]] = []
    for market in markets:
        provenance = load_candidate_provenance(source_dir, market_code=market.code)
        LOGGER.info("Processing market=%s candidates=%s", market.code, len(provenance))
        for index, vacancy_id in enumerate(sorted(provenance), start=1):
            detail_path = details_dir / market.code / f"{vacancy_id}.json"
            if detail_path.exists() and not refresh_details:
                LOGGER.debug(
                    "Reusing market=%s vacancy=%s (%s/%s)",
                    market.code,
                    vacancy_id,
                    index,
                    len(provenance),
                )
                detail = _read_json(detail_path)
            else:
                LOGGER.info(
                    "Fetching market=%s vacancy=%s (%s/%s)",
                    market.code,
                    vacancy_id,
                    index,
                    len(provenance),
                )
                detail = client.get_vacancy(vacancy_id, host=market.host)
                _write_json(detail_path, detail)
            records.append(
                to_processed_record(
                    detail,
                    provenance[vacancy_id],
                    market,
                    skill_definitions,
                )
            )
    if not records:
        selected = ", ".join(market.code for market in markets)
        raise ValueError(f"No candidates for markets {selected} found in {source_dir}")

    history_update: HistoryUpdate | None = None
    history_path = settings.project_root / "data" / "processed" / "vacancy_history.sqlite3"
    if search_mode == "strict":
        included_for_history = [
            record for record in records if record["review_decision"] == "included"
        ]
        observed_at = str(audit_report.get("finished_at") or datetime.now(UTC).isoformat())
        history_update, lifecycle = update_history(
            database_path=history_path,
            collection_id=collection_id,
            observed_at=observed_at,
            records=included_for_history,
        )
        for record in records:
            key = (str(record["market"]), str(record["vacancy_id"]))
            record.update(
                lifecycle.get(
                    key,
                    {
                        "first_seen_at": None,
                        "last_seen_at": None,
                        "observation_count": 0,
                    },
                )
            )

    processed_path = (
        settings.project_root / "data" / "processed" / f"vacancies{output_suffix}_latest.jsonl"
    )
    _write_jsonl(processed_path, records)
    review_path = (
        settings.project_root
        / "data"
        / "processed"
        / f"manual_review{output_suffix}_latest.csv"
    )
    _write_review_csv(review_path, records)

    decision_counts = Counter(str(record["review_decision"]) for record in records)
    role_counts = Counter(
        str(record["role_family"])
        for record in records
        if record["review_decision"] == "included"
    )
    included_records = [
        record for record in records if record["review_decision"] == "included"
    ]
    skill_counts = Counter(
        skill
        for record in included_records
        for skill in record["skills_normalized"]
    )
    seniority_counts = Counter(
        str(record["seniority"]) for record in included_records
    )
    market_counts = _market_counts(records)
    report = {
        "schema_version": 4,
        "created_at": datetime.now(UTC).isoformat(),
        "source_collection_id": collection_id,
        "markets": [market.code for market in markets],
        "market_counts": market_counts,
        "market_summary": _market_summary(records),
        "search_mode": search_mode,
        "candidates": len(records),
        "decision_counts": dict(sorted(decision_counts.items())),
        "included_role_counts": dict(sorted(role_counts.items())),
        "included_seniority_counts": dict(sorted(seniority_counts.items())),
        "included_skill_counts": dict(skill_counts.most_common()),
        "included_with_any_skill": sum(
            bool(record["skills_normalized"]) for record in included_records
        ),
        "salary_coverage_included": _salary_coverage(records),
        "outputs": {
            "processed_jsonl": str(processed_path.relative_to(settings.project_root)),
            "manual_review_csv": str(review_path.relative_to(settings.project_root)),
            "history_database": (
                str(history_path.relative_to(settings.project_root))
                if history_update is not None
                else None
            ),
        },
        "history_update": (
            {
                "new_vacancies": history_update.new_vacancies,
                "existing_vacancies": history_update.existing_vacancies,
                "total_tracked": history_update.total_tracked,
            }
            if history_update is not None
            else None
        ),
        "warning": (
            "Automatic title rules are scope filters, not ground truth; validate a "
            "sample manually before publishing analytical claims."
        ),
    }
    report_path = (
        settings.project_root
        / "artifacts"
        / "reports"
        / f"classification{output_suffix}_latest.json"
    )
    _write_json(report_path, report)
    return report_path


def load_candidate_provenance(
    source_dir: Path, *, market_code: str
) -> dict[str, dict[str, list[str]]]:
    provenance: dict[str, dict[str, set[str]]] = defaultdict(
        lambda: {"roles": set(), "queries": set()}
    )
    market_dir = source_dir / "search_pages" / market_code
    for page_path in sorted(market_dir.glob("*/*/page_*.json")):
        role_code = page_path.parent.parent.name
        payload = _read_json(page_path)
        for item in payload.get("items", []):
            if not isinstance(item, dict) or item.get("id") is None:
                continue
            vacancy_id = str(item["id"])
            provenance[vacancy_id]["roles"].add(role_code)
            provenance[vacancy_id]["queries"].add(page_path.parent.name)
    return {
        vacancy_id: {
            "roles": sorted(values["roles"]),
            "queries": sorted(values["queries"]),
        }
        for vacancy_id, values in provenance.items()
    }


def to_processed_record(
    detail: dict[str, Any],
    provenance: dict[str, list[str]],
    market: Market,
    skill_definitions: tuple[SkillDefinition, ...],
) -> dict[str, Any]:
    title = str(detail.get("name") or "").strip()
    description_html = str(detail.get("description") or "")
    salary = detail.get("salary") if isinstance(detail.get("salary"), dict) else {}
    employer = detail.get("employer") if isinstance(detail.get("employer"), dict) else {}
    area = detail.get("area") if isinstance(detail.get("area"), dict) else {}
    experience = detail.get("experience") if isinstance(detail.get("experience"), dict) else {}
    schedule = detail.get("schedule") if isinstance(detail.get("schedule"), dict) else {}
    employment = detail.get("employment") if isinstance(detail.get("employment"), dict) else {}
    key_skills = detail.get("key_skills") if isinstance(detail.get("key_skills"), list) else []
    key_skill_names = [
        str(skill.get("name")).strip()
        for skill in key_skills
        if isinstance(skill, dict) and skill.get("name")
    ]
    description_text = " ".join(strip_html(description_html).split())
    decision = classify_role(title, description_text)
    experience_id = experience.get("id")
    seniority = classify_seniority(
        title=title,
        experience_id=str(experience_id) if experience_id is not None else None,
        description=description_text,
    )
    skill_evidence = extract_skills(
        title=title,
        description=description_text,
        key_skills=key_skill_names,
        definitions=skill_definitions,
    )
    normalized_salary = normalize_salary(
        salary.get("from"),
        salary.get("to"),
        salary.get("currency"),
        market.currency,
    )
    return {
        "vacancy_id": str(detail.get("id") or ""),
        "market": market.code,
        "title": title,
        "alternate_url": detail.get("alternate_url"),
        "published_at": detail.get("published_at"),
        "archived": bool(detail.get("archived", False)),
        "employer": employer.get("name"),
        "city": area.get("name"),
        "experience": experience_id,
        "seniority": seniority.seniority,
        "seniority_confidence": seniority.confidence,
        "seniority_reasons": list(seniority.reason_codes),
        "schedule": schedule.get("id"),
        "employment": employment.get("id"),
        "salary_from": salary.get("from"),
        "salary_to": salary.get("to"),
        "salary_currency": salary.get("currency"),
        "salary_gross": salary.get("gross"),
        "salary_midpoint_local": normalized_salary.midpoint_local,
        "salary_normalization_status": normalized_salary.status,
        "key_skills_raw": key_skill_names,
        "skills_normalized": list(skill_evidence),
        "skill_evidence": skill_evidence,
        "description_text": description_text,
        "candidate_role_hints": provenance["roles"],
        "candidate_query_slugs": provenance["queries"],
        "review_decision": decision.decision,
        "role_family": decision.role_family,
        "classification_confidence": decision.confidence,
        "classification_reasons": list(decision.reason_codes),
    }


def _salary_coverage(records: list[dict[str, Any]]) -> float | None:
    included = [record for record in records if record["review_decision"] == "included"]
    if not included:
        return None
    with_salary = sum(
        record["salary_from"] is not None or record["salary_to"] is not None
        for record in included
    )
    return round(with_salary / len(included), 4)


def _market_counts(records: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    counts: dict[str, Counter[str]] = defaultdict(Counter)
    for record in records:
        counts[str(record["market"])][str(record["review_decision"])] += 1
    return {
        market: dict(sorted(decisions.items()))
        for market, decisions in sorted(counts.items())
    }


def _market_summary(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    markets = sorted({str(record["market"]) for record in records})
    for market in markets:
        candidates = [record for record in records if record["market"] == market]
        included = [
            record for record in candidates if record["review_decision"] == "included"
        ]
        with_salary = sum(
            record["salary_from"] is not None or record["salary_to"] is not None
            for record in included
        )
        roles = Counter(str(record["role_family"]) for record in included)
        seniority = Counter(str(record["seniority"]) for record in included)
        summaries.append(
            {
                "market": market,
                "candidates": len(candidates),
                "included": len(included),
                "with_salary": with_salary,
                "salary_coverage": (
                    round(with_salary / len(included), 4) if included else None
                ),
                "role_counts": dict(sorted(roles.items())),
                "seniority_counts": dict(sorted(seniority.items())),
            }
        )
    return summaries


def _write_review_csv(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(
            destination,
            fieldnames=(
                "market",
                "vacancy_id",
                "title",
                "alternate_url",
                "review_decision",
                "role_family",
                "seniority",
                "experience",
                "seniority_reasons",
                "classification_reasons",
                "human_decision",
                "human_role_family",
                "human_seniority",
                "review_notes",
            ),
        )
        writer.writeheader()
        for record in records:
            writer.writerow(
                {
                    "market": record["market"],
                    "vacancy_id": record["vacancy_id"],
                    "title": record["title"],
                    "alternate_url": record["alternate_url"] or "",
                    "review_decision": record["review_decision"],
                    "role_family": record["role_family"] or "",
                    "seniority": record["seniority"],
                    "experience": record["experience"] or "",
                    "seniority_reasons": ";".join(record["seniority_reasons"]),
                    "classification_reasons": ";".join(record["classification_reasons"]),
                    "human_decision": "",
                    "human_role_family": "",
                    "human_seniority": "",
                    "review_notes": "",
                }
            )
    temporary.replace(path)


def _read_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"Required file does not exist: {path}") from error
    if not isinstance(payload, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return payload


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    serialized = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
    temporary.write_text(serialized, encoding="utf-8")
    temporary.replace(path)


def _write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        "".join(
            json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n"
            for record in records
        ),
        encoding="utf-8",
    )
    temporary.replace(path)


if __name__ == "__main__":
    main()
