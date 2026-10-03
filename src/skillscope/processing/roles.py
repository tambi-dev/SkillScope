"""Deterministic and auditable role-relevance classification."""

from __future__ import annotations

import html
import re
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class RoleDecision:
    decision: str
    role_family: str | None
    confidence: str
    reason_codes: tuple[str, ...]


ROLE_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "data_analyst": (
        re.compile(r"\bdata\s+analyst\b"),
        re.compile(r"\bаналитик\s+данных\b"),
        re.compile(r"\bдата\s+аналитик\b"),
    ),
    "bi_analyst": (
        re.compile(r"\bbi\s+analyst\b"),
        re.compile(r"\bbi\s+developer\s+analyst\b"),
        re.compile(r"\bbi\s+аналитик\b"),
        re.compile(r"\bаналитик\s+bi\b"),
        re.compile(r"\bbusiness\s+intelligence\s+analyst\b"),
    ),
    "data_scientist": (
        re.compile(r"\bdata\s+scientist\b"),
        re.compile(r"\bспециалист\s+по\s+data\s+science\b"),
    ),
    "ml_engineer": (
        re.compile(r"\bml\s+engineer\b"),
        re.compile(r"\bml\s+ai\s+engineer\b"),
        re.compile(r"\bmachine\s+learning\s+engineer\b"),
        re.compile(r"\bинженер\s+машинного\s+обучения\b"),
    ),
}

ROLE_PRIORITY = ("ml_engineer", "data_scientist", "bi_analyst", "data_analyst")

EXCLUSION_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "education_role",
        re.compile(
            r"\b(методолог|преподаватель|учитель|лектор|наставник|курсов|"
            r"educational|teacher|lecturer)\b"
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


def classify_role(title: str, description: str = "") -> RoleDecision:
    """Classify core roles by title, excluding clear teaching roles in the text."""

    normalized_title = normalize_text(title)

    exclusion_codes = tuple(
        code for code, pattern in EXCLUSION_PATTERNS if pattern.search(normalized_title)
    )
    if exclusion_codes:
        return RoleDecision("excluded", None, "high", exclusion_codes)

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

    matches = tuple(
        role
        for role, patterns in ROLE_PATTERNS.items()
        if any(pattern.search(normalized_title) for pattern in patterns)
    )
    if len(matches) == 1:
        return RoleDecision("included", matches[0], "high", ("target_role_in_title",))
    if len(matches) > 1:
        selected_role = next(role for role in ROLE_PRIORITY if role in matches)
        return RoleDecision(
            "included",
            selected_role,
            "medium",
            ("multiple_core_roles", "specific_role_priority"),
        )

    return RoleDecision("excluded", None, "high", ("no_target_role_in_title",))


def normalize_text(value: str) -> str:
    value = value.casefold().replace("ё", "е")
    value = re.sub(r"[-_/]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def strip_html(value: str) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", value)
    return html.unescape(without_tags)
