"""Deterministic and auditable role-relevance classification."""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from skillscope.config import RoleQueries, load_role_queries


@dataclass(frozen=True, slots=True)
class RoleDecision:
    decision: str
    role_family: str | None
    confidence: str
    reason_codes: tuple[str, ...]


DEFAULT_ROLE_CONFIG = Path(__file__).resolve().parents[1] / "role_catalog.toml"
LEGACY_DATA_ROLES = {"data_analyst", "bi_analyst", "data_scientist", "ml_engineer"}

EXCLUSION_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "education_role",
        re.compile(
            r"\b(методолог|преподаватель|учитель|лектор|наставник|ментор|курсов|"
            r"educational|teacher|lecturer|mentor)\b"
        ),
    ),
    (
        "accounting_role",
        re.compile(r"\b(специалист\s+по\s+учету|бухгалтер|data\s+entry)\b"),
    ),
)

EDUCATION_DESCRIPTION_PATTERN = re.compile(
    r"\b(проводить\s+(?:занятия|уроки)|"
    r"провер(?:ять|ка)\s+домашн\w*|оценивать\s+домашн\w*|"
    r"dars\s+ber\w*)\b"
)
ADJACENT_ROLE_DESCRIPTION_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "business_analyst_in_description",
        re.compile(
            r"\b(ищем|требуется|требуются|приглашаем)\s+"
            r"(?:сильного\s+)?бизнес\s+аналитик\w*\b"
        ),
    ),
)
FRONTEND_DESIGN_TITLE_PATTERN = re.compile(r"\b(?:ui\s+ux|ux\s+ui)\b")
DESIGN_WORK_PATTERN = re.compile(r"\b(?:figma|прототип\w*|макет\w*)\b")
FRONTEND_CODE_PATTERN = re.compile(
    r"\b(?:javascript|typescript|react|angular|vue|html|css|верстк\w*|программир\w*)\b"
)


def classify_role(
    title: str,
    description: str = "",
    roles: tuple[RoleQueries, ...] | None = None,
) -> RoleDecision:
    """Classify an IT role from its title and configured title patterns."""

    normalized_title = normalize_text(title)

    exclusion_codes = tuple(
        code for code, pattern in EXCLUSION_PATTERNS if pattern.search(normalized_title)
    )
    if exclusion_codes:
        return RoleDecision("excluded", None, "high", exclusion_codes)

    role_catalog = roles if roles is not None else _default_roles()
    patterns_by_role = _compiled_patterns(role_catalog)
    matches = tuple(
        role.code
        for role, (patterns, exclusions) in zip(
            role_catalog, patterns_by_role, strict=True
        )
        if any(pattern.search(normalized_title) for pattern in patterns)
        and not any(pattern.search(normalized_title) for pattern in exclusions)
    )
    if "frontend_developer" in matches and FRONTEND_DESIGN_TITLE_PATTERN.search(normalized_title):
        normalized_description = normalize_text(description)
        if (
            len(DESIGN_WORK_PATTERN.findall(normalized_description)) >= 2
            and not FRONTEND_CODE_PATTERN.search(normalized_description)
        ):
            return RoleDecision("excluded", None, "high", ("design_role_in_description",))
    if set(matches) & LEGACY_DATA_ROLES:
        normalized_description = normalize_text(description)
        adjacent_role_codes = tuple(
            code
            for code, pattern in ADJACENT_ROLE_DESCRIPTION_PATTERNS
            if pattern.search(normalized_description)
        )
        if adjacent_role_codes:
            return RoleDecision("excluded", None, "high", adjacent_role_codes)

        if EDUCATION_DESCRIPTION_PATTERN.search(normalized_description):
            return RoleDecision(
                "excluded", None, "high", ("education_role_in_description",)
            )
    if len(matches) == 1:
        return RoleDecision("included", matches[0], "high", ("target_role_in_title",))
    if len(matches) > 1:
        priority = {role.code: role.priority for role in role_catalog}
        selected_role = max(matches, key=lambda code: (priority[code], code))
        if set(matches) <= LEGACY_DATA_ROLES:
            return RoleDecision(
                "included",
                selected_role,
                "medium",
                ("multiple_core_roles", "specific_role_priority"),
            )
        return RoleDecision(
            "included",
            selected_role,
            "medium",
            ("multiple_target_roles", "configured_role_priority"),
        )

    return RoleDecision("excluded", None, "high", ("no_target_role_in_title",))


def normalize_text(value: str) -> str:
    value = value.casefold().replace("ё", "е")
    value = re.sub(r"[-_/]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


@cache
def _default_roles() -> tuple[RoleQueries, ...]:
    return load_role_queries(DEFAULT_ROLE_CONFIG)


@cache
def _compiled_patterns(
    roles: tuple[RoleQueries, ...],
) -> tuple[
    tuple[tuple[re.Pattern[str], ...], tuple[re.Pattern[str], ...]], ...
]:
    return tuple(
        (
            tuple(re.compile(pattern) for pattern in role.title_patterns),
            tuple(re.compile(pattern) for pattern in role.exclude_title_patterns),
        )
        for role in roles
    )


def strip_html(value: str) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", value)
    return html.unescape(without_tags)
