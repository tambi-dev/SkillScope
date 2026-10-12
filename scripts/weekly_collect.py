"""Run a validated weekly HeadHunter collection and keep a local recovery copy."""

from __future__ import annotations

import json
import logging
import msvcrt
import os
import shutil
import sqlite3
import sys
import tempfile
import zipfile
from collections.abc import Iterator
from contextlib import closing, contextmanager
from pathlib import Path
from typing import Any

from skillscope.audit import run_audit
from skillscope.collect import run_collection
from skillscope.config import Settings, load_markets, load_role_queries
from skillscope.exchange_rates import refresh_exchange_rates
from skillscope.ingestion.hh_client import HHClient

LOGGER = logging.getLogger("skillscope.weekly")
EXPECTED_MARKETS = {"kg", "kz", "uz", "tj", "tm", "ge", "ru"}
AUDIT_MAX_PAGES = 20
AUDIT_PER_PAGE = 100


@contextmanager
def _exclusive_lock(path: Path) -> Iterator[None]:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+b") as lock_file:
        lock_file.seek(0, os.SEEK_END)
        if lock_file.tell() == 0:
            lock_file.write(b"\0")
            lock_file.flush()
        lock_file.seek(0)
        try:
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as error:
            raise RuntimeError("Another weekly collection is already running") from error
        try:
            yield
        finally:
            lock_file.seek(0)
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)


def run_weekly_collection(project_root: Path) -> Path:
    settings = Settings.from_environment(project_root)
    if not settings.hh_access_token:
        raise ValueError("HH_ACCESS_TOKEN is required for scheduled collections")

    markets = load_markets(project_root / "config" / "markets.toml")
    roles = load_role_queries(project_root / "src" / "skillscope" / "role_catalog.toml")
    if {market.code for market in markets} != EXPECTED_MARKETS:
        raise ValueError("Weekly collection must include all seven configured markets")

    client = HHClient(
        user_agent=settings.hh_user_agent,
        access_token=settings.hh_access_token,
        timeout_seconds=settings.request_timeout_seconds,
        max_retries=settings.max_retries,
    )
    report_dir = project_root / "data" / "processed" / "weekly" / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    latest_audit_path = report_dir / "feasibility_latest.json"
    run_audit(
        settings=settings,
        client=client,
        markets=markets,
        roles=roles,
        max_pages=AUDIT_MAX_PAGES,
        per_page=AUDIT_PER_PAGE,
        search_mode="strict",
        output_path=latest_audit_path,
    )
    audit_report = _read_json(latest_audit_path)
    _validate_audit(audit_report, markets=markets, roles=roles)

    collection_id = str(audit_report["collection_id"])
    audit_archive_path = report_dir / f"{collection_id}_feasibility.json"
    shutil.copy2(latest_audit_path, audit_archive_path)
    LOGGER.info(
        "Audit passed: %s candidates; zero-match markets are recorded explicitly",
        audit_report["overall"]["unique_candidates"],
    )

    classification_path = run_collection(
        settings=settings,
        client=client,
        markets=markets,
        audit_report_path=audit_archive_path,
    )
    classification = _read_json(classification_path)
    if classification.get("source_collection_id") != collection_id:
        raise ValueError("Collection report does not match the validated audit")

    backup_path = _create_recovery_copy(
        project_root=project_root,
        collection_id=collection_id,
        audit_path=audit_archive_path,
        classification_path=classification_path,
        classification=classification,
    )
    try:
        refresh_exchange_rates(project_root, classification["created_at"][:10])
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        LOGGER.warning("Exchange rates were not updated: %s", error)
    LOGGER.info(
        "Collection complete: included=%s excluded=%s backup=%s",
        classification["decision_counts"].get("included", 0),
        classification["decision_counts"].get("excluded", 0),
        backup_path,
    )
    for market in sorted(EXPECTED_MARKETS):
        summary = next(
            (item for item in classification["market_summary"] if item["market"] == market),
            None,
        )
        if summary is None:
            LOGGER.warning("market=%s has no matching vacancies in this snapshot", market)
        elif summary["included"] < 20:
            LOGGER.warning("market=%s has a small sample: %s included", market, summary["included"])
    return backup_path


def _validate_audit(
    report: dict[str, Any], *, markets: tuple[Any, ...], roles: tuple[Any, ...]
) -> None:
    if report.get("authenticated") is not True:
        raise ValueError("HeadHunter audit was not authenticated")
    market_codes = {str(item.get("code")) for item in report.get("markets", [])}
    if market_codes != EXPECTED_MARKETS:
        raise ValueError("Audit report does not cover all seven markets")
    role_codes = {str(item.get("code")) for item in report.get("roles", [])}
    if role_codes != {role.code for role in roles}:
        raise ValueError("Audit report does not cover the configured role catalog")
    expected_queries = sum(len(role.queries) for role in roles) * len(markets)
    queries = report.get("queries", [])
    if len(queries) != expected_queries:
        raise ValueError(f"Expected {expected_queries} query results, found {len(queries)}")
    if any(item.get("truncated") for item in queries):
        raise ValueError("Audit report is truncated; collection was skipped")
    if not report.get("overall", {}).get("unique_candidates"):
        raise ValueError("Audit returned no candidates in any market; collection was skipped")


def _create_recovery_copy(
    *,
    project_root: Path,
    collection_id: str,
    audit_path: Path,
    classification_path: Path,
    classification: dict[str, Any],
) -> Path:
    processed_dir = project_root / "data" / "processed"
    database_path = processed_dir / "vacancy_history.sqlite3"
    snapshot_path = project_root / str(classification["outputs"]["snapshot_jsonl"])
    review_path = project_root / str(classification["outputs"]["manual_review_csv"])
    raw_dir = project_root / "data" / "raw" / collection_id
    for path in (database_path, snapshot_path, review_path, raw_dir):
        if not path.exists():
            raise FileNotFoundError(f"Required collection output is missing: {path}")

    backup_root = processed_dir / "weekly" / "backups"
    backup_root.mkdir(parents=True, exist_ok=True)
    final_dir = backup_root / collection_id
    if final_dir.exists():
        raise FileExistsError(f"Recovery copy already exists: {final_dir}")

    with tempfile.TemporaryDirectory(prefix=f".{collection_id}-", dir=backup_root) as temporary:
        temporary_path = Path(temporary) / "payload"
        temporary_path.mkdir()
        backup_database_path = temporary_path / "vacancy_history.sqlite3"
        with closing(sqlite3.connect(database_path)) as source, closing(
            sqlite3.connect(backup_database_path)
        ) as destination:
            source.backup(destination)
        with closing(sqlite3.connect(backup_database_path)) as connection:
            result = connection.execute("PRAGMA integrity_check").fetchone()
            if result is None or result[0] != "ok":
                raise RuntimeError("SQLite recovery copy failed its integrity check")

        shutil.copy2(audit_path, temporary_path / "feasibility.json")
        shutil.copy2(classification_path, temporary_path / "classification.json")
        shutil.copy2(snapshot_path, temporary_path / "snapshot.jsonl")
        shutil.copy2(review_path, temporary_path / "manual_review.csv")
        with zipfile.ZipFile(
            temporary_path / "raw_payloads.zip",
            mode="w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=6,
        ) as archive:
            for raw_path in sorted(raw_dir.rglob("*")):
                if raw_path.is_file():
                    archive.write(raw_path, raw_path.relative_to(raw_dir.parent))
        with zipfile.ZipFile(temporary_path / "raw_payloads.zip") as archive:
            bad_member = archive.testzip()
            if bad_member is not None:
                raise RuntimeError(f"Raw payload archive failed validation: {bad_member}")

        temporary_path.replace(final_dir)
    return final_dir


def _read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def main() -> int:
    project_root = Path(__file__).resolve().parents[1]
    log_dir = project_root / "data" / "processed" / "weekly" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "weekly_collection.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(log_path, encoding="utf-8"), logging.StreamHandler()],
        force=True,
    )
    lock_path = project_root / "data" / "processed" / "weekly_collection.lock"
    try:
        with _exclusive_lock(lock_path):
            backup_path = run_weekly_collection(project_root)
    except Exception:
        LOGGER.exception("Weekly collection failed")
        return 1
    LOGGER.info("Recovery copy ready: %s", backup_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
