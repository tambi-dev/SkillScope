# SkillScope — project status

Last updated: 2026-10-01

## Current milestone

Phase 8 — readable dashboard, browser verification and Render deployment preparation.

## Scope

- Data Analyst
- BI Analyst
- Data Scientist
- ML Engineer
- Geography: Kazakhstan (`area=40`), Kyrgyzstan (`area=48`), Uzbekistan (`area=97`)
- Adjacent analyst roles are excluded from the current code and dataset.

## Completed

- Python package scaffold and project configuration.
- Market and search-query configuration.
- HeadHunter API client with pagination, retries and `429`/`5xx` handling.
- Vacancy-search feasibility command with raw snapshots and summary report.
- Data card and initial architecture decision record.
- Unit tests for configuration, candidate deduplication and API error handling.
- HeadHunter application registration approved.
- Secure `client_credentials` exchange; access token remains in the gitignored `.env`.
- First authenticated Kyrgyzstan feasibility check completed on 2026-09-25.
- Search changed to exact title terms with `no_magic=true` after search results revealed
  HeadHunter synonym expansion.
- Full vacancy details are fetched once per unique candidate and preserved as raw data.
- Deterministic title-first classifier implemented for core roles with explicit reason
  codes and a documented priority for hybrid core titles.
- Reviewable JSONL and UTF-8 CSV outputs added.
- Config-driven skill normalization implemented for the initial 14-skill ontology;
  every skill retains its evidence source.
- Conservative salary normalization implemented in each market's local currency.
- Kazakhstan and Uzbekistan added without pooling country-level salary statistics.
- Transparent seniority classification added with title, description and experience
  evidence plus confidence and reason codes.
- Idempotent SQLite history added with `first_seen_at`, `last_seen_at` and observation
  counts for every included core vacancy.
- 47 unit tests pass, including regression coverage for teaching/business role filtering,
  conservative seniority, review retention and API responses.
- Stratified manual review sheet initially created with 23 included records spanning
  the observed country-role-seniority strata and all 9 excluded candidates.
- Preliminary EDA generated for country, role, seniority, skill frequencies,
  co-occurrence and local-currency salary summaries.
- Manual review of 23 included sample rows and 9 excluded candidates found one false
  positive: a teaching vacancy titled `Data Analyst`. All sampled exclusions were upheld.
- Review confirmed that HeadHunter experience bands are not seniority classes. The
  automatic rule now maps 3–6 years alone to Unknown; ambiguous multi-level ads also
  remain Unknown. Clear teaching duties in a description now override an exact core
  role title, based on the Data Analyst instructor false positive.
- The current review sheet contains 45 annotations: 34 in-scope and 11 out-of-scope.
- Second authenticated strict snapshot collected on 2026-10-01: 95 candidates. Final
  classification includes 84 and excludes 11 after an additional description-mismatch
  rule was applied; the same role/market scope was retained.
- Longitudinal history recorded 70 repeated and 15 newly tracked included vacancies;
  96 unique vacancies are now present in SQLite across both snapshots.
- Read-only FastAPI endpoints added for overview, skills, salary, seniority and model
  readiness. The API was smoke-tested against the current processed snapshot.
- Responsive React + TypeScript dashboard added with country/role filters, skills and
  seniority charts, salary coverage table, model-readiness notice and methodology note.
- Production frontend build passes; chart and React dependencies are split into
  separate bundles.
- Added a strict-allowlist demo-data generator. The bundled snapshot retains only
  de-identified analytical fields and omits vacancy IDs, titles, employers, links and
  descriptions.
- API falls back to the packaged demo snapshot when no local processed dataset exists;
  the frontend shows which source is active.
- Built React assets are packaged with the Python app and served by FastAPI. Local
  review now needs one server command rather than separate API and Vite processes.
- Increased small UI labels to at least 12px and adjusted tablet/phone layouts.
- All KPI counts now follow filters. Loading and errors hide stale results; failed
  requests can be retried. Changing filters aborts previous requests.
- Country composition and an expanded Methodology section are visible in the dashboard.
- Five frontend request tests and a Playwright browser smoke script cover filtering,
  loading, retry, empty results and 1366/1024/390/320px viewport widths.
- Render Blueprint configured for one Free Python service using the packaged frontend
  and demo data. No hosting account has been connected and nothing is published yet.
- Built wheel checked in a temporary directory: demo API, HTML and linked static assets
  work without the repository's private data or editable source installation.

## Current snapshot

- First snapshot had 90 strict-search candidates; second snapshot has 95.
- The current processed snapshot includes 84 vacancies and excludes 11.
- Data Analyst: 43.
- BI Analyst: 5.
- Data Scientist: 14.
- ML Engineer: 22.
- By country: Kyrgyzstan 4, Kazakhstan 38, Uzbekistan 42 included vacancies.
- Five complete salary ranges remain after
  normalization. This is far too small for a defensible salary model.
- Current seniority counts: Junior 4, Middle 36, Senior 15, Unknown 29. Many are
  Unknown because the 3–6-year experience band does not determine one level.
- Skill extraction remains dictionary-based and not independently validated.

## Next actions

1. Connect the repository to the user's GitHub/Render accounts and publish the prepared demo.
2. Add one purposeful Lottie visualization after deciding its data explanation.
3. Collect another snapshot later to distinguish persistent trends from one-day changes.
4. Reconsider a salary model only after complete salary observations grow substantially.

## Verification

```powershell
$env:PYTHONPATH = "src"
python -m unittest discover -s tests -v
python -m compileall -q src tests
```

## Guidance for a new chat

Read `README.md`, `STATUS.md`, `docs/data-card.md` and the files under
`docs/decisions/` before making changes. Continue from the first
unfinished item under **Next actions**, keep changes scoped, and run verification before
reporting completion.
