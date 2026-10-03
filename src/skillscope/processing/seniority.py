"""Transparent seniority classification from title, text and HH experience bands."""

from __future__ import annotations

import re
from dataclasses import dataclass

from skillscope.processing.roles import normalize_text


@dataclass(frozen=True, slots=True)
class SeniorityDecision:
    seniority: str
    confidence: str
    reason_codes: tuple[str, ...]


TITLE_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "Junior": (
        re.compile(r"\bjunior\b"),
        re.compile(r"\bjr\b"),
        re.compile(r"\bстажер\b"),
        re.compile(r"\bмладший\b"),
    ),
    "Middle": (
        re.compile(r"\bmiddle\b"),
        re.compile(r"\bmid\b"),
        re.compile(r"\bмидл\b"),
    ),
    "Senior": (
        re.compile(r"\bsenior\b"),
        re.compile(r"\bsr\b"),
        re.compile(r"\blead\b"),
        re.compile(r"\bprincipal\b"),
        re.compile(r"\bstaff\b"),
        re.compile(r"\bстарший\b"),
        re.compile(r"\bведущий\b"),
    ),
}

DESCRIPTION_LEVEL_PATTERN = re.compile(
    r"\b(?:уровень|уровня|level|grade|позиция)\s*[:\-]?\s*"
    r"(junior|middle|senior|младший|мидл|старший)\b"
)

DESCRIPTION_LABELS = {
    "junior": "Junior",
    "младший": "Junior",
    "middle": "Middle",
    "мидл": "Middle",
    "senior": "Senior",
    "старший": "Senior",
}

EXPERIENCE_RULES = {
    "noExperience": SeniorityDecision("Junior", "medium", ("experience_no_experience",)),
    "between1And3": SeniorityDecision("Middle", "medium", ("experience_1_to_3",)),
    "between3And6": SeniorityDecision(
        "Unknown", "low", ("experience_3_to_6_ambiguous",)
    ),
    "moreThan6": SeniorityDecision("Senior", "high", ("experience_more_than_6",)),
}


def classify_seniority(
    *,
    title: str,
    experience_id: str | None,
    description: str = "",
) -> SeniorityDecision:
    """Apply title first, then explicit description level, then experience band."""

    normalized_title = normalize_text(title)
    title_matches = tuple(
        level
        for level, patterns in TITLE_PATTERNS.items()
        if any(pattern.search(normalized_title) for pattern in patterns)
    )
    if len(title_matches) == 1:
        return SeniorityDecision(
            title_matches[0],
            "high",
            ("explicit_title_seniority",),
        )
    if len(title_matches) > 1:
        return SeniorityDecision(
            "Unknown",
            "low",
            ("conflicting_title_seniority",),
        )

    normalized_description = normalize_text(description)
    description_match = DESCRIPTION_LEVEL_PATTERN.search(normalized_description)
    if description_match:
        label = DESCRIPTION_LABELS[description_match.group(1)]
        return SeniorityDecision(label, "medium", ("explicit_description_seniority",))

    if experience_id in EXPERIENCE_RULES:
        return EXPERIENCE_RULES[experience_id]

    return SeniorityDecision("Unknown", "low", ("insufficient_seniority_evidence",))
