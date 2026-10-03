# First exploratory analysis (original rule snapshot)

Snapshot date: 2026-09-25  
Source: configured strict-title search on the HeadHunter API  
Dataset: 90 unique candidates; 81 automatically included core vacancies

The figures below preserve the initial EDA snapshot before manual rule review. After
review, a teaching vacancy titled `Data Analyst` was excluded and seniority mapping
was made more conservative; current aggregates are in `eda_latest.json`.

## Snapshot composition

| Country | Included | Data Analyst | BI Analyst | Data Scientist | ML Engineer | Any salary reported |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Kyrgyzstan | 4 | 3 | 1 | 0 | 0 | 1 (25.0%) |
| Kazakhstan | 42 | 20 | 2 | 10 | 10 | 7 (16.7%) |
| Uzbekistan | 35 | 16 | 2 | 4 | 13 | 3 (8.6%) |
| Total | 81 | 39 | 5 | 14 | 23 | 11 (13.6%) |

The country and role mix is uneven. Combined counts should therefore be shown alongside
country composition, and should not be described as a population-weighted Central Asian
estimate.

## Early skill patterns

Across all 81 included vacancies, Python and SQL each appear in 63 vacancy texts (77.8%).
Power BI appears in 35 (43.2%), Pandas in 32 (39.5%), and Machine Learning in 37
(45.7%). These are mentions captured by a small configured skill dictionary. The
percentages describe text coverage in this snapshot, not definitive employer demand.

Within the five BI Analyst vacancies, SQL and Power BI each appear in all five; this
group is too small for a stable estimate. For Data Analyst vacancies, SQL appears in
34 of 39, while Power BI and Python each appear in 27 of 39. Among ML Engineer
vacancies, Machine Learning appears in 23 of 23 and Python in 21 of 23.

## Seniority and salary

Seniority counts are Junior 3, Middle 32, Senior 42 and Unknown 4. The majority of
labels came from broad experience bands; the report retains confidence and rule
reasons so these labels are not mistaken for employer-declared levels.

Eleven vacancies report at least one salary boundary, but only seven have complete
ranges that support a midpoint calculation. Those seven complete ranges are split
across four country-role groups. Each group has between one and four observations, so
the medians in `salary_summary.csv` are descriptive examples only. No salary model or
cross-country salary comparison is justified by this snapshot.

## Validation sample

`data/processed/validation_sample_latest.csv` contains:

- one included vacancy from each observed country × core role × seniority stratum;
- all currently excluded candidates;
- separate review fields for core decision, role, seniority and notes.

This sample is for auditing whether the rules behave sensibly across the observed
strata. The current CSV has 45 reviewed records: 34 in-scope and 11 out-of-scope. The
review is Codex-assisted at the project owner's request, not independent human
validation. It caught two title/content mismatches: a teaching role and an ad seeking a
business analyst despite a `Data Analyst` title. Narrow description rules now exclude
both. This small, deliberately stratified sample cannot support a statistically precise
accuracy claim. Model columns remain unchanged, and the EDA generator preserves
reviewed records on later runs.

HeadHunter provides experience bands (for example, no experience, 1–3 years and 3–6
years), not employer-declared Junior/Middle/Senior labels. Review levels therefore use
explicit seniority in the title first, then role responsibilities and experience.
Experience of 3–6 years alone does not determine a level and is now mapped to Unknown
by the automatic rule. Ads that explicitly span multiple levels also remain Unknown
when the intended level cannot be resolved.

## Reproducibility

```powershell
$env:PYTHONPATH = "src"
python -m skillscope.eda
```

Outputs:

- `artifacts/reports/eda_latest.json` — complete aggregate report and limitations.
- `artifacts/reports/skills_by_market.csv` — skill frequencies with denominators.
- `artifacts/reports/skills_by_role.csv` — skill frequencies by core role.
- `artifacts/reports/salary_summary.csv` — medians only for complete local-currency ranges.
- `data/processed/validation_sample_latest.csv` — human review sheet; local and gitignored.
