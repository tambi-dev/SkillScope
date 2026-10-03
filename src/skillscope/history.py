"""Idempotent SQLite storage for longitudinal vacancy observations."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True, slots=True)
class HistoryUpdate:
    new_vacancies: int
    existing_vacancies: int
    total_tracked: int


def update_history(
    *,
    database_path: Path,
    collection_id: str,
    observed_at: str,
    records: list[dict[str, Any]],
) -> tuple[HistoryUpdate, dict[tuple[str, str], dict[str, Any]]]:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    try:
        connection.row_factory = sqlite3.Row
        _create_schema(connection)
        existing_keys = {
            (str(row["market"]), str(row["vacancy_id"]))
            for row in connection.execute("SELECT market, vacancy_id FROM vacancies")
        }
        for record in records:
            _upsert_vacancy(connection, record, observed_at)
            _upsert_observation(connection, record, collection_id, observed_at)
        connection.commit()

        keys = {(str(record["market"]), str(record["vacancy_id"])) for record in records}
        lifecycle = _load_lifecycle(connection, keys)
        total_tracked = int(
            connection.execute("SELECT COUNT(*) FROM vacancies").fetchone()[0]
        )
    finally:
        connection.close()

    new_vacancies = len(keys - existing_keys)
    return (
        HistoryUpdate(
            new_vacancies=new_vacancies,
            existing_vacancies=len(keys) - new_vacancies,
            total_tracked=total_tracked,
        ),
        lifecycle,
    )


def _create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS vacancies (
            market TEXT NOT NULL,
            vacancy_id TEXT NOT NULL,
            first_seen_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            title TEXT NOT NULL,
            employer TEXT,
            role_family TEXT,
            seniority TEXT NOT NULL,
            published_at TEXT,
            archived INTEGER NOT NULL,
            PRIMARY KEY (market, vacancy_id)
        );

        CREATE TABLE IF NOT EXISTS observations (
            collection_id TEXT NOT NULL,
            observed_at TEXT NOT NULL,
            market TEXT NOT NULL,
            vacancy_id TEXT NOT NULL,
            title TEXT NOT NULL,
            role_family TEXT,
            seniority TEXT NOT NULL,
            salary_from REAL,
            salary_to REAL,
            salary_currency TEXT,
            archived INTEGER NOT NULL,
            PRIMARY KEY (collection_id, market, vacancy_id)
        );

        CREATE INDEX IF NOT EXISTS idx_observations_vacancy
            ON observations (market, vacancy_id, observed_at);
        PRAGMA user_version = 1;
        """
    )


def _upsert_vacancy(
    connection: sqlite3.Connection,
    record: dict[str, Any],
    observed_at: str,
) -> None:
    connection.execute(
        """
        INSERT INTO vacancies (
            market, vacancy_id, first_seen_at, last_seen_at, title, employer,
            role_family, seniority, published_at, archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (market, vacancy_id) DO UPDATE SET
            first_seen_at = MIN(vacancies.first_seen_at, excluded.first_seen_at),
            last_seen_at = MAX(vacancies.last_seen_at, excluded.last_seen_at),
            title = excluded.title,
            employer = excluded.employer,
            role_family = excluded.role_family,
            seniority = excluded.seniority,
            published_at = excluded.published_at,
            archived = excluded.archived
        """,
        (
            record["market"],
            record["vacancy_id"],
            observed_at,
            observed_at,
            record["title"],
            record["employer"],
            record["role_family"],
            record["seniority"],
            record["published_at"],
            int(bool(record["archived"])),
        ),
    )


def _upsert_observation(
    connection: sqlite3.Connection,
    record: dict[str, Any],
    collection_id: str,
    observed_at: str,
) -> None:
    connection.execute(
        """
        INSERT INTO observations (
            collection_id, observed_at, market, vacancy_id, title, role_family,
            seniority, salary_from, salary_to, salary_currency, archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (collection_id, market, vacancy_id) DO UPDATE SET
            observed_at = excluded.observed_at,
            title = excluded.title,
            role_family = excluded.role_family,
            seniority = excluded.seniority,
            salary_from = excluded.salary_from,
            salary_to = excluded.salary_to,
            salary_currency = excluded.salary_currency,
            archived = excluded.archived
        """,
        (
            collection_id,
            observed_at,
            record["market"],
            record["vacancy_id"],
            record["title"],
            record["role_family"],
            record["seniority"],
            record["salary_from"],
            record["salary_to"],
            record["salary_currency"],
            int(bool(record["archived"])),
        ),
    )


def _load_lifecycle(
    connection: sqlite3.Connection,
    keys: set[tuple[str, str]],
) -> dict[tuple[str, str], dict[str, Any]]:
    lifecycle: dict[tuple[str, str], dict[str, Any]] = {}
    for market, vacancy_id in keys:
        row = connection.execute(
            """
            SELECT
                vacancies.first_seen_at,
                vacancies.last_seen_at,
                COUNT(observations.collection_id) AS observation_count
            FROM vacancies
            LEFT JOIN observations USING (market, vacancy_id)
            WHERE vacancies.market = ? AND vacancies.vacancy_id = ?
            GROUP BY vacancies.market, vacancies.vacancy_id
            """,
            (market, vacancy_id),
        ).fetchone()
        if row is None:
            raise RuntimeError(f"Missing lifecycle for {market}/{vacancy_id}")
        lifecycle[(market, vacancy_id)] = {
            "first_seen_at": str(row["first_seen_at"]),
            "last_seen_at": str(row["last_seen_at"]),
            "observation_count": int(row["observation_count"]),
        }
    return lifecycle
