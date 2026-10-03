"""Config-driven, explainable skill normalization."""

from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass
from pathlib import Path

from skillscope.processing.roles import normalize_text


@dataclass(frozen=True, slots=True)
class SkillDefinition:
    code: str
    label: str
    aliases: tuple[str, ...]


def load_skill_definitions(path: Path) -> tuple[SkillDefinition, ...]:
    with path.open("rb") as source:
        payload = tomllib.load(source)
    definitions: list[SkillDefinition] = []
    for code, values in payload.get("skills", {}).items():
        label = values.get("label")
        aliases = tuple(str(value).strip() for value in values.get("aliases", []))
        invalid_definition = (
            not isinstance(label, str)
            or not label.strip()
            or not aliases
            or any(not value for value in aliases)
        )
        if invalid_definition:
            raise ValueError(f"Skill {code!r} must have a label and non-empty aliases")
        definitions.append(SkillDefinition(str(code), label.strip(), aliases))
    if not definitions:
        raise ValueError(f"No skill definitions found in {path}")
    return tuple(definitions)


def extract_skills(
    *,
    title: str,
    description: str,
    key_skills: list[str],
    definitions: tuple[SkillDefinition, ...],
) -> dict[str, list[str]]:
    """Return canonical skill labels and the fields that supplied evidence."""

    fields = {
        "title": normalize_text(title),
        "key_skills": normalize_text(" ".join(key_skills)),
        "description": normalize_text(description),
    }
    evidence: dict[str, list[str]] = {}
    for definition in definitions:
        patterns = tuple(_alias_pattern(alias) for alias in definition.aliases)
        sources = [
            source
            for source, text in fields.items()
            if any(pattern.search(text) for pattern in patterns)
        ]
        if sources:
            evidence[definition.label] = sources
    return evidence


def _alias_pattern(alias: str) -> re.Pattern[str]:
    normalized = normalize_text(alias)
    escaped = re.escape(normalized).replace(r"\ ", r"\s+")
    return re.compile(rf"(?<!\w){escaped}(?!\w)")
