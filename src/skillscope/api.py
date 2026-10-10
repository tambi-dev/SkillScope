"""Read-only API for the latest processed SkillScope snapshot."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean, median
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.staticfiles import StaticFiles

from skillscope.config import load_role_categories, load_role_queries

Market = Literal["kg", "kz", "uz"]
SENIORITY_LEVELS = ("Junior", "Middle", "Senior", "Unknown")
MARKET_CURRENCIES = {"kg": "KGS", "kz": "KZT", "uz": "UZS"}


class SkillItem(BaseModel):
    skill: str
    vacancies_with_skill: int
    share: float


class SkillsResponse(BaseModel):
    market: str | None
    role: str | None
    category: str | None
    vacancy_denominator: int
    items: list[SkillItem]


class SalaryGroup(BaseModel):
    market: str
    currency: str
    role_family: str
    role_category: str | None
    included_vacancies: int
    vacancies_with_reported_salary: int
    complete_salary_ranges: int
    coverage: float | None
    median_midpoint_local: float | None


class MarketSalaryCoverage(BaseModel):
    currency: str | None
    included_vacancies: int
    with_reported_salary: int
    coverage: float | None


class SeniorityItem(BaseModel):
    seniority: str
    vacancies: int
    share: float
    mean_skill_count: float | None


class SeniorityResponse(BaseModel):
    market: str | None
    role: str | None
    category: str | None
    vacancy_denominator: int
    items: list[SeniorityItem]


class OverviewResponse(BaseModel):
    data_mode: Literal["processed", "demo"]
    last_seen_at: str | None
    candidate_vacancies: int
    included_vacancies: int
    excluded_candidates: int
    markets: list[str]
    role_counts: dict[str, int]
    seniority_counts: dict[str, int]
    salary_coverage_by_market: dict[str, MarketSalaryCoverage]


class TaxonomyRole(BaseModel):
    code: str
    label: str
    category: str


class TaxonomyCategory(BaseModel):
    code: str
    label: str
    roles: list[TaxonomyRole]


class RoleDemandItem(TaxonomyRole):
    vacancies: int
    share: float
    experience_observed_vacancies: int
    no_experience_required: int
    no_experience_share: float | None


class RoleDemandResponse(BaseModel):
    market: str | None
    category: str | None
    vacancy_denominator: int
    items: list[RoleDemandItem]


class ModelInsightsResponse(BaseModel):
    status: Literal["not_ready"]
    target: str
    complete_salary_ranges: int
    imputation_used: Literal[False]
    explanation: str


def _default_data_path() -> Path:
    project_root = Path(__file__).resolve().parents[2]
    processed_path = project_root / "data" / "processed" / "vacancies_latest.jsonl"
    if processed_path.exists():
        return processed_path
    return Path(__file__).with_name("demo_vacancies.jsonl")


def _read_records(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail="Processed data is unavailable. Run the SkillScope collection pipeline first.",
        )
    records: list[dict[str, Any]] = []
    try:
        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            payload = json.loads(line)
            if not isinstance(payload, dict):
                raise ValueError(f"Expected an object on line {line_number}")
            records.append(payload)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise HTTPException(status_code=503, detail="Processed data could not be read.") from error
    return records


def _included(
    records: list[dict[str, Any]],
    market: str | None,
    role: str | None,
    category: str | None,
    category_by_role: dict[str, str],
) -> list[dict[str, Any]]:
    return [
        record
        for record in records
        if record.get("review_decision") == "included"
        and (market is None or record.get("market") == market)
        and (role is None or record.get("role_family") == role)
        and (
            category is None
            or record.get("role_category") == category
            or category_by_role.get(str(record.get("role_family"))) == category
        )
    ]


def _validate_filters(
    role: str | None,
    category: str | None,
    role_codes: set[str],
    category_codes: set[str],
) -> None:
    if role is not None and role not in role_codes:
        raise HTTPException(status_code=422, detail="Unknown role code")
    if category is not None and category not in category_codes:
        raise HTTPException(status_code=422, detail="Unknown category code")


def _skill_counts(records: list[dict[str, Any]]) -> tuple[int, Counter[str]]:
    counts: Counter[str] = Counter()
    for record in records:
        counts.update(set(record.get("skills_normalized") or []))
    return len(records), counts


def create_app(data_path: Path | None = None) -> FastAPI:
    """Create an API app; data_path can point to a fixture in tests."""

    source_path = data_path or _default_data_path()
    role_path = Path(__file__).with_name("role_catalog.toml")
    role_definitions = load_role_queries(role_path)
    role_categories = load_role_categories(role_path)
    roles_by_code = {role.code: role for role in role_definitions}
    categories_by_code = {category.code: category for category in role_categories}
    category_by_role = {role.code: role.category for role in role_definitions}
    role_codes = set(roles_by_code)
    category_codes = set(categories_by_code)
    app = FastAPI(
        title="SkillScope API",
        version="0.1.0",
        description="Descriptive statistics for IT vacancies in Central Asia.",
    )

    @app.get("/api/overview", response_model=OverviewResponse, tags=["overview"])
    def overview() -> OverviewResponse:
        records = _read_records(source_path)
        included = _included(records, None, None, None, category_by_role)
        by_role = Counter(str(record.get("role_family")) for record in included)
        by_seniority = Counter(str(record.get("seniority") or "Unknown") for record in included)
        market_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for record in included:
            market_rows[str(record.get("market") or "unknown")].append(record)

        salary_coverage: dict[str, MarketSalaryCoverage] = {}
        for market, rows in sorted(market_rows.items()):
            reported = sum(
                row.get("salary_from") is not None or row.get("salary_to") is not None
                for row in rows
            )
            salary_coverage[market] = MarketSalaryCoverage(
                currency=MARKET_CURRENCIES.get(market),
                included_vacancies=len(rows),
                with_reported_salary=reported,
                coverage=round(reported / len(rows), 4) if rows else None,
            )

        last_seen = max(
            (str(record.get("last_seen_at")) for record in records if record.get("last_seen_at")),
            default=None,
        )
        return OverviewResponse(
            data_mode="demo" if source_path.name == "demo_vacancies.jsonl" else "processed",
            last_seen_at=last_seen,
            candidate_vacancies=len(records),
            included_vacancies=len(included),
            excluded_candidates=len(records) - len(included),
            markets=sorted(market_rows),
            role_counts=dict(sorted(by_role.items())),
            seniority_counts=dict(sorted(by_seniority.items())),
            salary_coverage_by_market=salary_coverage,
        )

    @app.get("/api/taxonomy", response_model=list[TaxonomyCategory], tags=["roles"])
    def taxonomy() -> list[TaxonomyCategory]:
        return [
            TaxonomyCategory(
                code=category.code,
                label=category.label,
                roles=[
                    TaxonomyRole(code=role.code, label=role.label, category=role.category)
                    for role in role_definitions
                    if role.category == category.code
                ],
            )
            for category in role_categories
        ]

    @app.get("/api/roles", response_model=RoleDemandResponse, tags=["roles"])
    def roles(
        market: Market | None = None,
        category: str | None = None,
    ) -> RoleDemandResponse:
        _validate_filters(
            role=None,
            category=category,
            role_codes=role_codes,
            category_codes=category_codes,
        )
        records = _included(
            _read_records(source_path), market, None, category, category_by_role
        )
        counts = Counter(str(record.get("role_family")) for record in records)
        experience_counts = Counter(
            str(record.get("role_family"))
            for record in records
            if record.get("experience") is not None
        )
        no_experience_counts = Counter(
            str(record.get("role_family"))
            for record in records
            if record.get("experience") == "noExperience"
        )
        return RoleDemandResponse(
            market=market,
            category=category,
            vacancy_denominator=len(records),
            items=[
                RoleDemandItem(
                    code=role.code,
                    label=role.label,
                    category=role.category,
                    vacancies=counts[role.code],
                    share=round(counts[role.code] / len(records), 4) if records else 0.0,
                    experience_observed_vacancies=experience_counts[role.code],
                    no_experience_required=no_experience_counts[role.code],
                    no_experience_share=(
                        round(
                            no_experience_counts[role.code]
                            / experience_counts[role.code],
                            4,
                        )
                        if experience_counts[role.code]
                        else None
                    ),
                )
                for role in role_definitions
                if category is None or role.category == category
            ],
        )

    @app.get("/api/skills", response_model=SkillsResponse, tags=["skills"])
    def skills(
        market: Market | None = None,
        role: str | None = None,
        category: str | None = None,
        limit: int = Query(default=20, ge=1, le=100),
    ) -> SkillsResponse:
        _validate_filters(role, category, role_codes, category_codes)
        records = _included(
            _read_records(source_path), market, role, category, category_by_role
        )
        denominator, counts = _skill_counts(records)
        items = [
            SkillItem(
                skill=skill,
                vacancies_with_skill=count,
                share=round(count / denominator, 4) if denominator else 0.0,
            )
            for skill, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[
                :limit
            ]
        ]
        return SkillsResponse(
            market=market,
            role=role,
            category=category,
            vacancy_denominator=denominator,
            items=items,
        )

    @app.get("/api/salaries", response_model=list[SalaryGroup], tags=["salary"])
    def salaries(
        market: Market | None = None,
        role: str | None = None,
        category: str | None = None,
    ) -> list[SalaryGroup]:
        _validate_filters(role, category, role_codes, category_codes)
        records = _included(
            _read_records(source_path), market, role, category, category_by_role
        )
        groups: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
        for record in records:
            market_code = str(record.get("market") or "unknown")
            groups[
                (
                    market_code,
                    str(
                        record.get("salary_currency")
                        or MARKET_CURRENCIES.get(market_code, "unknown")
                    ),
                    str(record.get("role_family") or "Unknown"),
                )
            ].append(record)

        result: list[SalaryGroup] = []
        for (market_code, currency, role_family), rows in sorted(groups.items()):
            midpoints = [
                float(row["salary_midpoint_local"])
                for row in rows
                if isinstance(row.get("salary_midpoint_local"), int | float)
                and not isinstance(row.get("salary_midpoint_local"), bool)
            ]
            reported = sum(
                row.get("salary_from") is not None or row.get("salary_to") is not None
                for row in rows
            )
            result.append(
                SalaryGroup(
                    market=market_code,
                    currency=currency,
                    role_family=role_family,
                    role_category=category_by_role.get(role_family),
                    included_vacancies=len(rows),
                    vacancies_with_reported_salary=reported,
                    complete_salary_ranges=len(midpoints),
                    coverage=round(reported / len(rows), 4) if rows else None,
                    median_midpoint_local=median(midpoints) if midpoints else None,
                )
            )
        return result

    @app.get("/api/seniority", response_model=SeniorityResponse, tags=["seniority"])
    def seniority(
        market: Market | None = None,
        role: str | None = None,
        category: str | None = None,
    ) -> SeniorityResponse:
        _validate_filters(role, category, role_codes, category_codes)
        records = _included(
            _read_records(source_path), market, role, category, category_by_role
        )
        groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for record in records:
            groups[str(record.get("seniority") or "Unknown")].append(record)

        items: list[SeniorityItem] = []
        for level in SENIORITY_LEVELS:
            rows = groups.get(level, [])
            skill_counts = [len(set(row.get("skills_normalized") or [])) for row in rows]
            items.append(
                SeniorityItem(
                    seniority=level,
                    vacancies=len(rows),
                    share=round(len(rows) / len(records), 4) if records else 0.0,
                    mean_skill_count=round(mean(skill_counts), 2) if skill_counts else None,
                )
            )
        return SeniorityResponse(
            market=market,
            role=role,
            category=category,
            vacancy_denominator=len(records),
            items=items,
        )

    @app.get(
        "/api/model-insights",
        response_model=ModelInsightsResponse,
        tags=["model"],
    )
    def model_insights() -> ModelInsightsResponse:
        records = _included(
            _read_records(source_path), None, None, None, category_by_role
        )
        complete_ranges = sum(
            isinstance(record.get("salary_midpoint_local"), int | float)
            and not isinstance(record.get("salary_midpoint_local"), bool)
            for record in records
        )
        return ModelInsightsResponse(
            status="not_ready",
            target="salary_midpoint_local",
            complete_salary_ranges=complete_ranges,
            imputation_used=False,
            explanation=(
                "No salary model has been trained: complete salary observations are too "
                "limited for a defensible holdout evaluation. Missing salaries remain null."
            ),
        )

    static_dir = Path(__file__).with_name("static")
    index_path = static_dir / "index.html"
    assets_path = static_dir / "assets"
    if index_path.is_file() and assets_path.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

        @app.get("/", include_in_schema=False)
        def dashboard() -> FileResponse:
            return FileResponse(index_path)

    return app


app = create_app()
