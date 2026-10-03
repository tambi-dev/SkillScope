"""Conservative salary normalization for analytical use."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class NormalizedSalary:
    midpoint_local: float | None
    status: str


def normalize_salary(
    salary_from: object,
    salary_to: object,
    currency: object,
    expected_currency: str,
) -> NormalizedSalary:
    lower = _number_or_none(salary_from)
    upper = _number_or_none(salary_to)
    if lower is None and upper is None:
        return NormalizedSalary(None, "missing")
    if currency != expected_currency:
        return NormalizedSalary(None, "currency_mismatch")
    if lower is None or upper is None:
        return NormalizedSalary(None, "one_sided_range")
    if lower > upper:
        return NormalizedSalary(None, "invalid_range")
    return NormalizedSalary(round((lower + upper) / 2, 2), "complete_range")


def _number_or_none(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value)
