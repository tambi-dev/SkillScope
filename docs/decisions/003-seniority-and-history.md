# ADR 003: Seniority heuristic and longitudinal storage

**Status:** accepted  
**Date:** 2026-09-25

## Decision

SkillScope assigns Junior, Middle, Senior or Unknown with deterministic rules. Explicit
title markers have priority, followed by explicit description markers and then the
HeadHunter experience band.

Included vacancies are stored in a local SQLite database keyed by country and vacancy
ID. Each collection creates at most one observation per vacancy.

## Rationale

The source does not provide a universal seniority field. A documented heuristic is more
auditable than a black-box model. SQLite provides transactional deduplication without
adding a database service or dependency.

## Guardrails

- Experience-based seniority is labelled as inferred, not employer-declared.
- The 3–6-year experience band alone maps to Unknown because it spans multiple levels.
- Conflicting title levels produce Unknown.
- Reprocessing one collection is idempotent.
- A missing vacancy is not automatically treated as closed.
- The local database and vacancy text remain excluded from Git.
