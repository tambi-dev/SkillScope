# SkillScope data card

## Source

HeadHunter vacancy search and vacancy detail API.

## Population represented

Public vacancies returned by HeadHunter for the configured search terms in
Kyrgyzstan, Kazakhstan, Uzbekistan, Tajikistan, Turkmenistan, Georgia and Russia.
This is not a census of any national labour market.

## Initial role families

- Data & AI: Data Analyst, BI Analyst, Data Scientist, ML Engineer
- Software Engineering: Backend, Frontend, Full-stack Developer
- DevOps & Cloud: DevOps Engineer
- Cybersecurity: Information Security Specialist
- QA: QA Engineer

The packaged 2026-10-12 demo covers all seven configured markets and ten roles.
The collection found 2,541 candidates; deterministic role rules retained 2,297 and
excluded 244. Included vacancies by market: Kyrgyzstan 15, Kazakhstan 186,
Uzbekistan 133, Georgia 38 and Russia 1,925. No configured role matched in
Tajikistan or Turkmenistan. Only 263 included vacancies have complete salary ranges.
The demo omits vacancy identity and full text. Its classifications have not been
manually validated as a representative sample.

The [stratified validation note](validation-2026-10-10.md) documents a 40-vacancy
manual role review and skill-dictionary coverage check for the earlier 2026-10-10
five-market collection (338 included vacancies). It does not measure precision or
recall for the packaged 2026-10-12 demo.

## Known limitations

- HeadHunter does not cover every hiring channel in the seven configured markets.
- Search results may contain semantically unrelated vacancies.
- Configured title searches do not capture every relevant vacancy, and search depth may
  cap high-volume roles.
- Categories and countries have uneven sample sizes; small groups do not support reliable
  rankings or salary conclusions.
- Many employers do not publish salary information.
- A small number of employers may dominate the sample.
- Country and role samples remain uneven.
- Search coverage and API behaviour can change over time.
- Salary coverage is low and currently insufficient for a defensible salary model.
- Platform coverage differs substantially between countries: the 2026-10-10 audit
  found 19 total HeadHunter listings in Tajikistan and 2 in Turkmenistan, but none
  matched the configured IT roles. This is a source-coverage limitation, not evidence
  of zero IT hiring.
- Seniority is often inferred from broad experience bands rather than explicitly stated.

## Transformation policy

- Raw API payloads, processed vacancy text and manual-review files remain local.
- Strict runs retain deduplicated vacancy observations in local SQLite and a separate
  processed JSONL snapshot for each collection. Earlier SQLite observations do not gain
  newly added analytical fields until their source runs are reprocessed.
- Role inclusion uses deterministic title-first rules with explicit reason codes.
- Role inclusion uses configured title patterns and explicit priority for overlapping
  titles; search-query provenance alone does not determine a role.
- Skill aliases are versioned in `config/skills.toml`, and evidence sources are retained.
- Salary midpoint is available only for complete local-currency ranges; missing values
  are not imputed and currencies are not pooled.
- Seniority rules retain confidence and reason codes. Conflicting title levels remain
  `Unknown` instead of being forced into a category.

## Publication policy

Raw API responses are stored locally and excluded from Git. Before publishing any dataset,
the project must verify source terms and avoid redistributing full vacancy descriptions
without permission.
