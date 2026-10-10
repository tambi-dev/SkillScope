# SkillScope data card

## Source

HeadHunter vacancy search and vacancy detail API.

## Population represented

Public vacancies returned by HeadHunter for Kazakhstan, Kyrgyzstan and Uzbekistan and
the configured search terms. This is not a census of any national labour market.

## Initial role families

- Data & AI: Data Analyst, BI Analyst, Data Scientist, ML Engineer
- Software Engineering: Backend, Frontend, Full-stack Developer
- DevOps & Cloud: DevOps Engineer
- Cybersecurity: Information Security Specialist
- QA: QA Engineer

The expanded roles are provisional until their HeadHunter search results pass manual
review. The packaged demo snapshot currently contains only the previous Data-role sample.

## Known limitations

- HeadHunter does not cover every hiring channel in the three countries.
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
- Platform coverage can differ substantially between the three countries.
- Seniority is often inferred from broad experience bands rather than explicitly stated.

## Transformation policy

- Raw API payloads, processed vacancy text and manual-review files remain local.
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
