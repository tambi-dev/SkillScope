# Product

## Platform

web

## Users

Students and early-career Data/IT specialists exploring selected markets in Kyrgyzstan, Kazakhstan, Uzbekistan, Tajikistan, Turkmenistan, Georgia and Russia.

## Product Purpose

SkillScope turns HeadHunter vacancy snapshots into a clear view of skill demand, role mix, inferred seniority and advertised salary ranges. It helps early-career specialists decide which skills to develop and which roles to pursue.

## Positioning

SkillScope is scoped to five Central Asian markets plus Georgia and Russia, and ten IT roles in five fields. It compares observed vacancy signals where reviewed data exists, using explicit classification rules and reported local-currency salary ranges so users can inspect how results relate to vacancy evidence.

## Operating Context

Users choose a market, field and role, then explore Overview, My route, Roles & skills, and Salaries. My route compares two observed roles across all markets or within one country, then lets visitors mark familiar skills and see up to five frequently mentioned skills they have not marked for a chosen role. The interactive Market Radar previews and pins skill signals; its circle areas show frequency and its positions are illustrative. Users consult the methodology and snapshot date when interpreting results.

## Capabilities and Constraints

- The scope covers Data & AI, Software Engineering, DevOps & Cloud, Cybersecurity and QA across seven countries. The packaged 2026-10-12 snapshot contains all ten roles, with matching vacancies in Kyrgyzstan, Kazakhstan, Uzbekistan, Georgia and Russia. No configured role matched in Tajikistan or Turkmenistan on HeadHunter in this collection.
- HeadHunter search and vacancy detail APIs provide the source records. Results represent configured searches, not every hiring channel.
- Role and skill classification uses explicit rules and dictionaries. Seniority is inferred from titles, descriptions and broad experience bands.
- My route ranks explicit skill mentions in the current snapshot. It shows counts and warns about small samples; it does not assess a visitor's ability or predict job fit. Marked skills are stored only in the visitor's browser.
- Salary summaries use complete advertised ranges in local currency. Groups remain separate by currency; an optional USD display uses a saved reference rate dated to the vacancy snapshot. Missing values are not imputed, and current coverage is too small for a salary prediction model.
- Historical comparisons depend on available snapshots. Strict collection runs retain deduplicated observations with publication and collection dates, skills, roles, seniority and salary fields. The existing time series is still too limited for growth claims.
- Raw vacancy payloads and full text remain local. Published demo data omits identifying vacancy details.

## Brand Commitments

The product name is SkillScope.

## Evidence on Hand

- Project scope, source and transformation policy: `docs/data-card.md`.
- Dashboard and API source: `frontend/src/` and `src/skillscope/`.
- Processed snapshot and aggregate reports: `data/processed/` and `artifacts/reports/`.
- The 2026-10-12 seven-country collection found 2,541 candidates; 2,297 passed
  the title rules and are included in the packaged identity-stripped demo. None
  matched the configured roles in Tajikistan or Turkmenistan.

## Product Principles

- Help early-career specialists connect observed demand to learning and role choices.
- Keep comparisons grounded in vacancy counts, snapshot dates and market coverage.
- Explain inferred categories and preserve uncertainty in salary and seniority data.
- Keep original salaries visible beside optional USD conversions and avoid unsupported growth claims.
