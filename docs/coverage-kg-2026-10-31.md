# Kyrgyzstan search coverage check — 31 October 2026

## Why this was checked

HeadHunter's [Q3 2026 Kyrgyzstan report](https://bishkek.headhunter.kg/article/34483)
(published 14 October) reports a 16.4% year-on-year decrease in IT vacancies.
It covers HH's full IT category over a quarter. SkillScope's dated snapshots
cover ten configured roles, so the report cannot validate our counts, supply
missing weekly observations or establish an effect of AI on hiring.

## Same-day API comparison

The check used area `48`, host `headhunter.kg`, the live `/professional_roles`
IT category and `/vacancies` with those professional roles. All 225 returned
listings were retrieved in three pages, without reaching the 2,000-result cap.
The original 32 strict title queries were run on the same date for comparison.

- Original strict searches: 18 distinct candidates.
- Overlap with HH's broader IT category: 17 candidates.
- Four additional category listings matched existing SkillScope title rules.
  Their full descriptions confirmed backend development, frontend development,
  infrastructure automation with DevOps, and cybersecurity incident response.
- The other 204 category listings did not match the current title rules. This
  does not establish that all are irrelevant: generic titles, stack-specific
  developer jobs and other IT professions need separate scope decisions. HH's
  category also includes support, design, management and unrelated listings.

These are discovery counts, not a new processed snapshot or an estimate of
search recall. The dashboard still uses the 25 October collection; its 16
included Kyrgyzstan vacancies must not be compared directly with this audit.

## Correction for future collections

Four exact title queries were added to the existing role catalog:

- Backend Developer: `backend engineer`.
- Frontend Developer: `frontend engineer`.
- DevOps Engineer: `системный администратор DevOps`.
- Information Security Specialist: `кибербезопасности`.

Each query found one of the four missed listings in Kyrgyzstan. A bounded
count check across all seven markets found at most 52 results for any added
query, safely below the API search-depth limit at the time of the check.
The ten roles and classification rules are unchanged. Normal detail fetching,
deduplication and exclusions still apply in the next scheduled collection.

This expands search coverage from 32 to 36 queries per market. Any increase
after this change may reflect the added queries rather than market growth.
Comparisons across the change need a common query scope. Reclassifying older
raw data cannot recover vacancies that were never collected.

## Publication

The site shows one attributed quarterly context note only when Kyrgyzstan is
selected in Overview or the optional My route vacancy evidence. The report's
figures are kept separate from SkillScope's API aggregates and salary tables.
The dated note does not automatically advance to later quarters.

Raw API responses and the identity-level review remain in ignored local
`data/raw/kg_coverage_20261031/` and `data/processed/kg_coverage_20261031.json`.
