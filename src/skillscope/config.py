"""Configuration loading for the SkillScope ingestion pipeline."""

from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True, slots=True)
class Market:
    code: str
    name: str
    host: str
    area_id: str
    currency: str


@dataclass(frozen=True, slots=True)
class RoleQueries:
    code: str
    label: str
    queries: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Settings:
    project_root: Path
    hh_access_token: str | None
    hh_client_id: str | None
    hh_client_secret: str | None
    hh_user_agent: str
    request_timeout_seconds: float
    max_retries: int

    @classmethod
    def from_environment(cls, project_root: Path | None = None) -> Settings:
        root = project_root or Path(__file__).resolve().parents[2]
        _load_dotenv(root / ".env")
        token = os.getenv("HH_ACCESS_TOKEN") or None
        return cls(
            project_root=root,
            hh_access_token=token,
            hh_client_id=os.getenv("HH_CLIENT_ID") or None,
            hh_client_secret=os.getenv("HH_CLIENT_SECRET") or None,
            hh_user_agent=os.getenv(
                "HH_USER_AGENT", "SkillScope/0.1 (your-email@example.com)"
            ),
            request_timeout_seconds=float(os.getenv("HH_REQUEST_TIMEOUT_SECONDS", "20")),
            max_retries=int(os.getenv("HH_MAX_RETRIES", "4")),
        )


def load_markets(path: Path) -> tuple[Market, ...]:
    payload = _read_toml(path)
    markets: list[Market] = []
    for code, values in payload.get("markets", {}).items():
        if not values.get("enabled", True):
            continue
        markets.append(
            Market(
                code=code,
                name=_required_string(values, "name"),
                host=_required_string(values, "host"),
                area_id=_required_string(values, "area_id"),
                currency=_required_string(values, "currency"),
            )
        )
    if not markets:
        raise ValueError(f"No enabled markets found in {path}")
    return tuple(markets)


def load_role_queries(path: Path) -> tuple[RoleQueries, ...]:
    payload = _read_toml(path)
    roles: list[RoleQueries] = []
    for code, values in payload.get("roles", {}).items():
        queries = tuple(str(query).strip() for query in values.get("queries", []))
        if not queries or any(not query for query in queries):
            raise ValueError(f"Role {code!r} must contain non-empty queries")
        roles.append(
            RoleQueries(
                code=code,
                label=_required_string(values, "label"),
                queries=queries,
            )
        )
    if not roles:
        raise ValueError(f"No roles found in {path}")
    return tuple(roles)


def _read_toml(path: Path) -> dict[str, Any]:
    with path.open("rb") as source:
        return tomllib.load(source)


def _required_string(values: dict[str, Any], key: str) -> str:
    value = values.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Missing non-empty string field {key!r}")
    return value.strip()


def _load_dotenv(path: Path) -> None:
    """Load simple KEY=VALUE pairs without adding a runtime dependency."""

    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", maxsplit=1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
