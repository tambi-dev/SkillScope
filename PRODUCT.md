# Product

## Platform

web

## Users

Students and early-career Data/IT specialists exploring the labour market in Kyrgyzstan, Kazakhstan and Uzbekistan.

## Product Purpose

SkillScope turns HeadHunter vacancy snapshots into a clear view of skill demand, role mix, inferred seniority and advertised salary ranges. It helps early-career specialists decide which skills to develop and which roles to pursue.

## Positioning

SkillScope compares observed vacancy signals across three Central Asian markets and ten IT roles in five fields. Its analysis is based on explicit classification rules and reported local-currency salary ranges, so users can inspect how the results relate to vacancy evidence.

## Operating Context

Users choose a market, field and role, then explore Overview, Roles & experience, Skills and Salaries. The interactive Market Radar previews and pins skill signals; its circle areas show frequency and its positions are illustrative. Users consult the methodology and snapshot date when interpreting results.

## Capabilities and Constraints

- The scope covers Data & AI, Software Engineering, DevOps & Cloud, Cybersecurity and QA. The packaged snapshot still contains only the four original Data roles; other fields remain unsampled until reviewed data is available.
- HeadHunter search and vacancy detail APIs provide the source records. Results represent configured searches, not every hiring channel.
- Role and skill classification uses explicit rules and dictionaries. Seniority is inferred from titles, descriptions and broad experience bands.
- Salary summaries use complete advertised ranges in local currency. Currencies are kept separate, missing values are not imputed, and current coverage is too small for a salary prediction model.
- Historical comparisons depend on the available snapshots. The project currently records two snapshots; claims about growth should reflect that limited time series.
- Raw vacancy payloads and full text remain local. Published demo data omits identifying vacancy details.

## Brand Commitments

The product name is SkillScope.

## Evidence on Hand

- Project scope, source and transformation policy: `docs/data-card.md`.
- Dashboard and API source: `frontend/src/` and `src/skillscope/`.
- Processed snapshot and aggregate reports: `data/processed/` and `artifacts/reports/`.
- As of the 2026-10-01 snapshot, 84 of 95 candidates were included. Five complete salary ranges were available.

## Product Principles

- Help early-career specialists connect observed demand to learning and role choices.
- Keep comparisons grounded in vacancy counts, snapshot dates and market coverage.
- Explain inferred categories and preserve uncertainty in salary and seniority data.
- Compare local currencies separately and avoid unsupported growth claims.
