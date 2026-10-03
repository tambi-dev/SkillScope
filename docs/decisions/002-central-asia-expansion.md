# ADR 002: Three-country core-role scope

**Status:** accepted  
**Date:** 2026-09-25

## Decision

SkillScope covers Kazakhstan, Kyrgyzstan and Uzbekistan while retaining only four core
role families: Data Analyst, BI Analyst, Data Scientist and ML Engineer.

Financial, business, product, fraud and other adjacent analysts remain outside the
current dataset. They may be reconsidered only through a later explicit decision.

## Rationale

The Kyrgyzstan-only strict sample contained four accepted vacancies. Expanding geography
produced 81 accepted core vacancies in one snapshot without changing role definitions.
This improves analytical usefulness without inflating the sample with adjacent roles.

## Guardrails

- Country is a required analytical dimension.
- Country-level counts and salary coverage are always reported separately.
- Local-currency salaries are not pooled or compared directly.
- Combined charts must display country composition.
- Low salary coverage blocks salary modelling until the sample grows.
