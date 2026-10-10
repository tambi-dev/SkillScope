# SkillScope — project status

Last updated: 2026-10-10

## Current milestone

IT role taxonomy, Market Radar and responsive frontend redesign.

## Scope

- Data & AI: Data Analyst, BI Analyst, Data Scientist, ML Engineer
- Software Engineering: Backend, Frontend, Full-stack Developer
- DevOps & Cloud: DevOps Engineer
- Cybersecurity: Information Security Specialist
- QA: QA Engineer
- Geography: Kazakhstan (`area=40`), Kyrgyzstan (`area=48`), Uzbekistan (`area=97`)
- Role/category definitions and title patterns are config-driven. Expanded roles need a
  new HeadHunter sample and manual review before their charts can support market claims.

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
- Added a packaged role catalog for five categories and ten roles, preserving the four
  existing Data codes and their hybrid-title priority.
- Extended role classification, review exports, collection reports, EDA and read-only API
  filters to include categories. The API reports observed role counts and known
  no-experience requirements separately from inferred seniority.
- Expanded the skill alias list for software, cloud, security and QA technologies while
  avoiding common ambiguous short aliases.
- A strict HeadHunter title-search pilot covered the six new roles across KG/KZ/UZ. The
  backend/frontend/full-stack, DevOps and QA queries returned results in all three
  markets. Information Security returned 3 candidates in KG, 15 in KZ and 15 in UZ.
- Rechecked 264 unique vacancy titles across the IT-role and expanded security pilots.
  The current rules assign 249 titles to one of the six new roles and leave 15
  unclassified. QA/QC and security-sales title exclusions are configured; stack-specific
  titles between role and developer terms and QA Automation variants are supported.
- The title pilot is a search sample, not full-detail manual review. Some candidates may
  still be irrelevant, and title matching may miss valid roles. Security coverage in KG
  is too small for reliable comparisons. Salary figures in search cards are not used as
  salary evidence.
- Processed and demo snapshots remain Data-only until an expanded collection is reviewed.
- Expanded the React dashboard with taxonomy-driven market, field and role filters, role
  demand, a cross-field skill matrix, local-currency salary summaries, seniority and a
  separate no-experience-required access signal. Unsampled fields are labeled explicitly.
- Playwright browser smoke passed at 1366, 1024, 390 and 320px after the dashboard update.
- Frontend API tests pass (6); backend pytest passes (51 tests and 20 subtests).
- Production frontend build passes, with a separate React bundle and self-hosted Manrope.
- Added a strict-allowlist demo-data generator. The bundled snapshot retains only
  de-identified analytical fields and omits vacancy IDs, titles, employers, links and
  descriptions.
- API falls back to the packaged demo snapshot when no local processed dataset exists;
  the frontend shows which source is active.
- Built React assets are packaged with the Python app and served by FastAPI. Local
  review now needs one server command rather than separate API and Vite processes.
- Four analysis tabs share sticky filters: Overview, Roles & experience, Skills and Salaries.
- Market Radar supports hover previews, pinned skills, frequency comparisons, keyboard
  exploration and touch input. Scanning can be paused and respects reduced motion.
- Charts, ranked lists and salary tables expose sample counts, proportional scales and
  unsampled fields. Salary values stay separate by local currency.
- All KPI counts follow filters. The previous snapshot remains labeled and inert while
  loading; errors hide stale results and offer retry. Superseded requests are aborted.
- Browser checks cover filters, history, keyboard navigation, loading, retry, empty states,
  radar motion and 1366/1024/390/320px layouts. Returning to Overview preserves the
  workspace position without a jump.
- Render Blueprint configured for one Free Python service using the packaged frontend
  and demo data. No hosting account has been connected and nothing is published yet.
- Built wheel checked in a temporary directory: demo API, HTML and linked static assets
  work without the repository's private data or editable source installation.

## Current snapshot

The figures below are the pre-expansion baseline. They describe the four Data roles only;
no observation is available yet for the six newly added role families.

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

1. Collect full vacancy details for the six new roles and review title-classifier decisions.
2. Refresh and review the sanitized demo snapshot after the role coverage is validated.
3. Collect later snapshots to distinguish persistent trends from one-day changes.
4. Reconsider a salary model only after complete salary observations grow substantially.
5. Deploy the prepared demo to Render when hosting is requested.

## Verification

```powershell
$env:PYTHONPATH = "src"
python -m pytest
python -m ruff check src tests
python -m mypy src/skillscope
pnpm --dir frontend test
pnpm --dir frontend build
pnpm --dir frontend test:browser
node frontend/tests/radar-interactions.cjs
```

## Guidance for a new chat

Read `README.md`, `STATUS.md`, `docs/data-card.md` and the files under
`docs/decisions/` before making changes. Continue from the first
unfinished item under **Next actions**, keep changes scoped, and run verification before
reporting completion.
