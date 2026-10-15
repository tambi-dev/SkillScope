# SkillScope — project status

Last updated: 2026-10-14

## Current milestone

Beginner exploration: three field explanations, guided in-browser tasks and
a saved next learning step, with optional current vacancy evidence.

## Scope

- Data & AI: Data Analyst, BI Analyst, Data Scientist, ML Engineer
- Software Engineering: Backend, Frontend, Full-stack Developer
- DevOps & Cloud: DevOps Engineer
- Cybersecurity: Information Security Specialist
- QA: QA Engineer
- Geography: Kazakhstan (`area=40`), Kyrgyzstan (`area=48`), Uzbekistan (`area=97`),
  Tajikistan (`area=86`), Turkmenistan (`area=93`), Georgia and Russia.
- Role/category definitions and title patterns are config-driven. Expanded roles need a
  new HeadHunter sample and manual review before their charts can support market claims.

## Development history

- Added salary-only experience filtering with an all-level default and
  on-demand anonymised vacancy examples. Examples share the summary scope and
  preserve original salary amounts; the API whitelists public fields and normalises
  RUB/RUR aliases. See `docs/salary-guide.md` for method and limits.
- Added restrained task completion feedback with reduced-motion support and optional
  local sound. Country ordering now follows the overall snapshot's vacancy counts;
  salaries use one table with all figures visible and a vacancy-count caption beneath
  each amount. Dark theme and sound default to on, remembering manual choices;
  Mr. Scope sends on Enter and uses Shift+Enter for new lines.
- Added a beginner route with three plain-language field guides, everyday
  examples and short in-browser tasks. It shows one stage at a time and keeps
  optional vacancy evidence behind a disclosure. The earlier interest quiz and
  download-first exercises were removed after feedback about beginner clarity.
- Task drafts and reflections stay local. Existing saved reflections migrate to
  the new flow. Counts and entry signals follow the chosen market and snapshot.
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
- At that stage, processed and demo snapshots remained Data-only; the 2026-10-10
  collection and demo refresh below supersede that limit.
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
- Four analysis tabs cover Overview, My route, Roles & skills and Salaries.
  My route uses role-specific skill frequencies, browser-local known skills and clear
  count, date, empty-sample and small-sample labels; its results link to the skill matrix.
- Market Radar supports hover previews, pinned skills, frequency comparisons, keyboard
  exploration and touch input. Scanning can be paused and respects reduced motion.
- Charts, ranked lists and salary tables expose sample counts, proportional scales and
  unsampled fields. Salary values stay separate by local currency.
- All KPI counts follow filters. The previous snapshot remains labeled and inert while
  loading; errors hide stale results and offer retry. Superseded requests are aborted.
- Browser checks cover filters, history, keyboard navigation, loading, retry, empty states,
  radar motion and 1366/1024/390/320px layouts. Returning to Overview preserves the
  workspace position without a jump.
- Render Blueprint configured for one Python service using the packaged frontend
  and demo data. The user has launched the site on Render.
- Built wheel checked in a temporary directory: demo API, HTML and linked static assets
  work without the repository's private data or editable source installation.
- Added Tajikistan and Turkmenistan to collection configuration, API market filters and
  the dashboard. Both currently appear without reviewed observations.
- SQLite observations now retain publication and collection dates, category, experience,
  normalized skills and salary midpoint. Existing v1 databases migrate in place.
- Processed JSONL snapshots are retained by collection and market selection in local,
  gitignored storage while the dashboard continues to read the latest snapshot.

## Current packaged snapshot

- The 2026-10-12 demo has 2,541 candidates and 2,297 included vacancies across ten
  roles. It is a dated, identity-stripped export of HeadHunter search results.
- Included by market: Kyrgyzstan 15, Kazakhstan 186, Uzbekistan 133, Georgia 38,
  Russia 1,925, Tajikistan 0 and Turkmenistan 0. Russia makes up 84% of the
  combined sample.
- By category: Data & AI 693, Software Engineering 637, DevOps & Cloud 406,
  Cybersecurity 103 and QA 458. There are 263 complete salary ranges.
- The 40-vacancy manual review documents the earlier 2026-10-10 collection. It
  does not establish classification accuracy for this newer snapshot.

## Next actions

1. Reprocess the two older raw collections to backfill analytical history fields.
2. Monitor weekly collections and local backups; the 12 October run succeeded.
3. Add trend views after enough comparable collections exist; show sample sizes.
4. Reconsider a salary model only after complete salary observations grow substantially.

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
node frontend/tests/career-route.cjs
```

## Guidance for a new chat

Read `README.md`, `STATUS.md`, `docs/data-card.md` and the files under
`docs/decisions/` before making changes. Continue from the first
unfinished item under **Next actions**, keep changes scoped, and run verification before
reporting completion.
