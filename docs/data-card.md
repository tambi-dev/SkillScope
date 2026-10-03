# SkillScope data card

## Source

HeadHunter vacancy search and vacancy detail API.

## Population represented

Public vacancies returned by HeadHunter for Kazakhstan, Kyrgyzstan and Uzbekistan and
the configured search terms. This is not a census of any national labour market.

## Current role families

- Data Analyst
- BI Analyst
- Data Scientist
- ML Engineer

## Known limitations

- HeadHunter does not cover every hiring channel in the three countries.
- Search results may contain semantically unrelated vacancies.
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
- Adjacent analyst roles are excluded from the current scope even when they use data.
- Skill aliases are versioned in `config/skills.toml`, and evidence sources are retained.
- Salary midpoint is available only for complete local-currency ranges; missing values
  are not imputed and currencies are not pooled.
- Seniority rules retain confidence and reason codes. Conflicting title levels remain
  `Unknown` instead of being forced into a category.

## Publication policy

Raw API responses are stored locally and excluded from Git. Before publishing any dataset,
the project must verify source terms and avoid redistributing full vacancy descriptions
without permission.
