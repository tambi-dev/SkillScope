"""Read-only API for the latest processed SkillScope snapshot."""

from __future__ import annotations

import json
import logging
import os
import time
from collections import Counter, defaultdict, deque
from pathlib import Path
from statistics import mean, median
from threading import Lock
from typing import Any, Literal
from urllib.error import HTTPError, URLError

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.staticfiles import StaticFiles

from skillscope.ask import ask_groq, build_evidence, is_project_question, snapshot_date
from skillscope.config import load_role_categories, load_role_queries

logger = logging.getLogger(__name__)

Market = Literal["kg", "kz", "uz", "tj", "tm", "ge", "ru"]
SENIORITY_LEVELS = ("Junior", "Middle", "Senior", "Unknown")
MARKET_CURRENCIES = {
    "kg": "KGS", "kz": "KZT", "uz": "UZS", "tj": "TJS",
    "tm": "TMT", "ge": "GEL", "ru": "RUB",
}


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
    from_only_count: int
    to_only_count: int
    median_from_only_local: float | None
    median_to_only_local: float | None
    median_range_from_local: float | None
    median_range_to_local: float | None
    median_midpoint_local: float | None


class ExchangeRates(BaseModel):
    date: str
    source: str
    rates_per_usd: dict[str, float]


class SalaryExample(BaseModel):
    market: str
    role_family: str
    currency: str
    salary_from: float | None
    salary_to: float | None
    experience: str | None
    skills: list[str]


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


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=400)


class AskResponse(BaseModel):
    answer: str
    snapshot_date: str | None
    sample_size: int
    source: Literal["market", "project"] = "market"


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


def _salary_currency(record: dict[str, Any]) -> str:
    currency = str(record.get("salary_currency") or MARKET_CURRENCIES.get(
        str(record.get("market")), "unknown"
    ))
    return "RUB" if currency == "RUR" else currency


def _salary_number(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else None


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
        description=(
            "Descriptive statistics for selected IT vacancy markets "
            "in Central Asia, Georgia and Russia."
        ),
    )
    ask_times: deque[float] = deque()
    ask_lock = Lock()

    @app.get("/api/exchange-rates", response_model=ExchangeRates, tags=["salary"])
    def exchange_rates() -> ExchangeRates:
        path = Path(__file__).with_name("exchange_rates.json")
        if not path.exists():
            raise HTTPException(status_code=503, detail="Exchange rates are unavailable.")
        return ExchangeRates.model_validate_json(path.read_text(encoding="utf-8"))

    @app.get("/api/ask/status", tags=["ask"])
    def ask_status() -> dict[str, bool]:
        return {"available": bool(os.environ.get("GROQ_API_KEY"))}

    @app.post("/api/ask", response_model=AskResponse, tags=["ask"])
    def ask(request: AskRequest) -> AskResponse:
        question = request.question.strip()
        if len(question) < 3:
            raise HTTPException(
                status_code=422, detail="Enter a question of at least 3 characters."
            )
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(status_code=503, detail="Ask SkillScope is not configured yet.")

        records = _read_records(source_path)
        evidence, sample_size = build_evidence(
            records, question, {code: role.label for code, role in roles_by_code.items()},
            snapshot_date(records),
        )
        project_question = is_project_question(question)
        scope = evidence["scope"]
        russian = any("\u0400" <= char <= "\u04ff" for char in question)
        if (
            not project_question
            and scope["untracked_role_requested"]
            and not scope["tracked_role_requested"]
        ):
            return AskResponse(
                answer=(
                    "Data Engineer не входит в десять ролей SkillScope. "
                    "По этой выборке нельзя ответить на вопрос об этой роли."
                    if russian else
                    "Data Engineer is outside SkillScope's ten tracked roles, "
                    "so this snapshot cannot answer that role-specific question."
                ),
                snapshot_date=evidence["snapshot_date"],
                sample_size=0,
            )
        junior_question = "junior" in question.casefold() or "джун" in question.casefold()
        if (not project_question and junior_question and isinstance(scope["markets"], list)
                and isinstance(scope["roles"], list)
                and len(scope["markets"]) == len(scope["roles"]) == 1
                and evidence["market_roles"]
                and evidence["market_roles"][0]["seniority"]["Junior"] == 0):
            role_name, market_name = scope["roles"][0], scope["markets"][0]
            answer = (
                f"В текущей выборке нет проверенных вакансий Junior {role_name} "
                f"в {market_name}. По ней нельзя ранжировать навыки для этой группы. "
                "Это не означает, что найма нет."
                if russian else
                f"There are no reviewed Junior {role_name} vacancies in {market_name} "
                "in this snapshot. It cannot rank skills for that group. "
                "This does not mean there is no hiring."
            )
            return AskResponse(
                answer=answer, snapshot_date=evidence["snapshot_date"], sample_size=0
            )
        if not project_question and sample_size == 0:
            answer = (
                "В текущей выборке SkillScope нет подходящих проверенных вакансий. "
                "Это не означает, что найма нет."
                if russian else
                "No reviewed vacancies match this question in the current SkillScope snapshot. "
                "This does not mean there is no hiring in that market."
            )
            return AskResponse(
                answer=answer, snapshot_date=evidence["snapshot_date"], sample_size=0
            )

        if project_question:
            evidence, sample_size = {}, 0

        now = time.monotonic()
        with ask_lock:
            while ask_times and now - ask_times[0] > 86_400:
                ask_times.popleft()
            if len(ask_times) >= 200 or sum(now - item < 60 for item in ask_times) >= 3:
                raise HTTPException(
                    status_code=429, detail="Ask SkillScope is busy. Try again shortly."
                )
            ask_times.append(now)
        try:
            answer = ask_groq(question, evidence, api_key)
        except HTTPError as error:
            logger.warning("Groq rejected Ask SkillScope request: HTTP %s", error.code)
            if error.code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="The AI service is at its free-tier limit. Try again later.",
                ) from error
            raise HTTPException(
                status_code=503, detail="The AI service is temporarily unavailable."
            ) from error
        except (URLError, TimeoutError, KeyError, IndexError, ValueError) as error:
            logger.warning("Ask SkillScope request failed: %s", type(error).__name__)
            raise HTTPException(
                status_code=503, detail="The AI service is temporarily unavailable."
            ) from error
        if not answer:
            raise HTTPException(status_code=503, detail="The AI service returned no answer.")
        return AskResponse(
            answer=answer, snapshot_date=evidence.get("snapshot_date"),
            sample_size=sample_size, source="project" if project_question else "market",
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
            (
                str(record.get("collected_at") or record.get("last_seen_at"))
                for record in records
                if record.get("collected_at") or record.get("last_seen_at")
            ),
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
        experience: Literal["noExperience"] | None = None,
    ) -> list[SalaryGroup]:
        _validate_filters(role, category, role_codes, category_codes)
        records = _included(
            _read_records(source_path), market, role, category, category_by_role
        )
        if experience is not None:
            records = [row for row in records if row.get("experience") == experience]
        groups: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
        for record in records:
            market_code = str(record.get("market") or "unknown")
            groups[
                (
                    market_code,
                    _salary_currency(record),
                    str(record.get("role_family") or "Unknown"),
                )
            ].append(record)

        result: list[SalaryGroup] = []
        for (market_code, currency, role_family), rows in sorted(groups.items()):
            from_only = [
                float(row["salary_from"])
                for row in rows
                if isinstance(row.get("salary_from"), int | float)
                and not isinstance(row.get("salary_from"), bool)
                and row.get("salary_to") is None
            ]
            to_only = [
                float(row["salary_to"])
                for row in rows
                if isinstance(row.get("salary_to"), int | float)
                and not isinstance(row.get("salary_to"), bool)
                and row.get("salary_from") is None
            ]
            complete_ranges = [
                (float(row["salary_from"]), float(row["salary_to"]))
                for row in rows
                if isinstance(row.get("salary_from"), int | float)
                and not isinstance(row.get("salary_from"), bool)
                and isinstance(row.get("salary_to"), int | float)
                and not isinstance(row.get("salary_to"), bool)
            ]
            midpoints = [(lower + upper) / 2 for lower, upper in complete_ranges]
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
                    from_only_count=len(from_only),
                    to_only_count=len(to_only),
                    median_from_only_local=median(from_only) if from_only else None,
                    median_to_only_local=median(to_only) if to_only else None,
                    median_range_from_local=(
                        median(lower for lower, _ in complete_ranges)
                        if complete_ranges else None
                    ),
                    median_range_to_local=(
                        median(upper for _, upper in complete_ranges)
                        if complete_ranges else None
                    ),
                    median_midpoint_local=median(midpoints) if midpoints else None,
                )
            )
        return result

    @app.get("/api/salary-examples", response_model=list[SalaryExample], tags=["salary"])
    def salary_examples(
        market: Market,
        role: str,
        currency: str = Query(min_length=3, max_length=3, pattern="^[A-Z]{3}$"),
        experience: Literal["noExperience"] | None = None,
        limit: int = Query(default=3, ge=1, le=5),
    ) -> list[SalaryExample]:
        _validate_filters(role, None, role_codes, category_codes)
        currency = "RUB" if currency == "RUR" else currency
        records = [
            row for row in _included(
                _read_records(source_path), market, role, None, category_by_role
            )
            if _salary_currency(row) == currency
            and (experience is None or row.get("experience") == experience)
            and (_salary_number(row.get("salary_from")) is not None
                 or _salary_number(row.get("salary_to")) is not None)
        ]
        # Show one actual record per available format, then fill from snapshot order.
        selected: list[int] = []
        seen_formats: set[tuple[bool, bool]] = set()
        for index, row in enumerate(records):
            kind = (
                _salary_number(row.get("salary_from")) is not None,
                _salary_number(row.get("salary_to")) is not None,
            )
            if kind not in seen_formats:
                seen_formats.add(kind)
                selected.append(index)
        selected.extend(index for index in range(len(records)) if index not in selected)
        return [
            SalaryExample(
                market=market,
                role_family=role,
                currency=currency,
                salary_from=_salary_number(records[index].get("salary_from")),
                salary_to=_salary_number(records[index].get("salary_to")),
                experience=records[index].get("experience"),
                skills=[skill for skill in (records[index].get("skills_normalized") or [])
                        if isinstance(skill, str)][:5],
            ) for index in selected[:limit]
        ]

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

        @app.get("/privacy", include_in_schema=False)
        def privacy() -> FileResponse:
            return FileResponse(index_path)

    return app


app = create_app()
