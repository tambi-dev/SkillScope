# ADR 001: Initial project scope

**Status:** superseded by ADR 002  
**Date:** 2026-09-21

## Decision

SkillScope starts with Kyrgyzstan and four role families: Data Analyst, BI Analyst,
Data Scientist and ML Engineer.

Kazakhstan and Uzbekistan are not part of the initial dataset. The ingestion design is
market-aware so that they can later be added as a clearly separated regional benchmark.

## Rationale

Adding closely related roles creates useful comparisons without mixing unrelated labour
market segments. Expanding both roles and geography immediately would make coverage,
salary and representativeness questions harder to explain within the December deadline.

## Guardrails

- API search results are candidate records, not accepted vacancies.
- Adjacent roles such as Data Engineer remain outside the MVP.
- Ambiguous vacancies will be labelled `needs_review` instead of being forced into a role.
- Small samples are reported as a limitation; geography is never expanded silently.
