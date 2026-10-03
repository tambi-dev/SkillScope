"""Phase 1 feasibility audit for configured markets and role queries."""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
from collections import defaultdict
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from skillscope.config import Market, RoleQueries, Settings, load_markets, load_role_queries
from skillscope.ingestion.hh_client import HHApiError, HHClient

LOGGER = logging.getLogger("skillscope.audit")
MAX_RESULT_DEPTH = 2_000


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--market", action="append", help="Market code; repeat to select several"
    )
    parser.add_argument("--max-pages", type=int, default=20)
    parser.add_argument("--per-page", type=int, default=100)
    parser.add_argument(
        "--search-mode",
        choices=("strict", "broad"),
        default="strict",
        help="strict uses exact title terms; broad allows HeadHunter synonym expansion",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = Settings.from_environment()
    markets = load_markets(settings.project_root / "config" / "markets.toml")
    roles = load_role_queries(settings.project_root / "config" / "search_queries.toml")
    if args.market:
        selected = set(args.market)
        markets = tuple(market for market in markets if market.code in selected)
        missing = selected - {market.code for market in markets}
        if missing:
            parser.error(f"Unknown or disabled market codes: {', '.join(sorted(missing))}")

    client = HHClient(
        user_agent=settings.hh_user_agent,
        access_token=settings.hh_access_token,
        timeout_seconds=settings.request_timeout_seconds,
        max_retries=settings.max_retries,
    )
    try:
        report_path = run_audit(
            settings=settings,
            client=client,
            markets=markets,
            roles=roles,
            max_pages=args.max_pages,
            per_page=args.per_page,
            search_mode=args.search_mode,
        )
    except (HHApiError, OSError, ValueError) as error:
        LOGGER.error("Audit failed: %s", error)
        raise SystemExit(1) from error
    print(report_path)


def run_audit(
    *,
    settings: Settings,
    client: HHClient,
    markets: tuple[Market, ...],
    roles: tuple[RoleQueries, ...],
    max_pages: int,
    per_page: int,
    search_mode: str = "strict",
) -> Path:
    if max_pages < 1:
        raise ValueError("max_pages must be positive")
    if max_pages * per_page > MAX_RESULT_DEPTH:
        raise ValueError(f"Requested depth exceeds HeadHunter limit of {MAX_RESULT_DEPTH}")
    if search_mode not in {"strict", "broad"}:
        raise ValueError("search_mode must be 'strict' or 'broad'")

    started_at = datetime.now(UTC)
    collection_id = started_at.strftime("%Y%m%dT%H%M%SZ")
    run_dir = settings.project_root / "data" / "raw" / collection_id
    all_records: list[dict[str, Any]] = []
    query_results: list[dict[str, Any]] = []

    for market in markets:
        for role in roles:
            for query in role.queries:
                records, query_summary = _collect_query(
                    client=client,
                    market=market,
                    role=role,
                    query=query,
                    run_dir=run_dir,
                    max_pages=max_pages,
                    per_page=per_page,
                    search_mode=search_mode,
                )
                all_records.extend(records)
                query_results.append(query_summary)

    finished_at = datetime.now(UTC)
    report = build_report(
        collection_id=collection_id,
        started_at=started_at,
        finished_at=finished_at,
        markets=markets,
        roles=roles,
        query_results=query_results,
        records=all_records,
        authenticated=settings.hh_access_token is not None,
        search_mode=search_mode,
    )
    _write_json(run_dir / "manifest.json", report)
    report_name = (
        "feasibility_latest.json"
        if search_mode == "strict"
        else "feasibility_broad_latest.json"
    )
    report_path = settings.project_root / "artifacts" / "reports" / report_name
    _write_json(report_path, report)
    LOGGER.info("Audit complete: %s unique candidates", report["overall"]["unique_candidates"])
    return report_path


def _collect_query(
    *,
    client: HHClient,
    market: Market,
    role: RoleQueries,
    query: str,
    run_dir: Path,
    max_pages: int,
    per_page: int,
    search_mode: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    records: list[dict[str, Any]] = []
    pages_fetched = 0
    found = 0
    total_pages = 0
    query_dir = run_dir / "search_pages" / market.code / role.code / slugify(query)

    for page in range(max_pages):
        LOGGER.info(
            "Collecting market=%s role=%s query=%r page=%s",
            market.code,
            role.code,
            query,
            page,
        )
        payload = client.search_vacancies(
            text=query,
            area_id=market.area_id,
            host=market.host,
            page=page,
            per_page=per_page,
            exact_title_terms=search_mode == "strict",
        )
        _write_json(query_dir / f"page_{page:03d}.json", payload)
        pages_fetched += 1
        found = _safe_int(payload.get("found"))
        total_pages = _safe_int(payload.get("pages"))
        for item in payload.get("items", []):
            if isinstance(item, dict):
                tagged = dict(item)
                tagged["_audit_market"] = market.code
                tagged["_audit_role"] = role.code
                tagged["_audit_query"] = query
                records.append(tagged)
        if page + 1 >= total_pages:
            break

    return records, {
        "market": market.code,
        "role": role.code,
        "query": query,
        "search_mode": search_mode,
        "api_found": found,
        "pages_available": total_pages,
        "pages_fetched": pages_fetched,
        "candidates_fetched": len(records),
        "truncated": pages_fetched < total_pages,
    }


def build_report(
    *,
    collection_id: str,
    started_at: datetime,
    finished_at: datetime,
    markets: tuple[Market, ...],
    roles: tuple[RoleQueries, ...],
    query_results: list[dict[str, Any]],
    records: list[dict[str, Any]],
    authenticated: bool,
    search_mode: str = "strict",
) -> dict[str, Any]:
    unique_records = _unique_by_id(records)
    role_records: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouping_key = (
            str(record.get("_audit_market")),
            str(record.get("_audit_role")),
        )
        role_records[grouping_key].append(record)

    role_summary: list[dict[str, Any]] = []
    for market in markets:
        for role in roles:
            candidates = _unique_by_id(role_records[(market.code, role.code)])
            role_summary.append(
                {
                    "market": market.code,
                    "role": role.code,
                    "label": role.label,
                    "unique_candidates": len(candidates),
                    "with_salary": sum(item.get("salary") is not None for item in candidates),
                    "salary_coverage": _ratio(
                        sum(item.get("salary") is not None for item in candidates),
                        len(candidates),
                    ),
                }
            )

    overall_with_salary = sum(item.get("salary") is not None for item in unique_records)
    warnings = [
        "Search candidates have not yet passed relevance classification or manual review.",
        "API result counts can overlap across queries and role families.",
    ]
    if not authenticated:
        warnings.append("The audit used anonymous access and may be interrupted by captcha.")

    return {
        "schema_version": 1,
        "collection_id": collection_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "authenticated": authenticated,
        "search_mode": search_mode,
        "markets": [asdict(market) for market in markets],
        "roles": [asdict(role) for role in roles],
        "queries": query_results,
        "role_summary": role_summary,
        "overall": {
            "unique_candidates": len(unique_records),
            "with_salary": overall_with_salary,
            "salary_coverage": _ratio(overall_with_salary, len(unique_records)),
        },
        "warnings": warnings,
    }


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    if normalized:
        return normalized
    return hashlib.sha1(value.encode("utf-8"), usedforsecurity=False).hexdigest()[:12]


def _unique_by_id(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for record in records:
        vacancy_id = record.get("id")
        if vacancy_id is not None:
            unique.setdefault(str(vacancy_id), record)
    return list(unique.values())


def _safe_int(value: object) -> int:
    return int(value) if isinstance(value, int | str) else 0


def _ratio(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 4) if denominator else None


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    temporary.replace(path)


if __name__ == "__main__":
    main()
