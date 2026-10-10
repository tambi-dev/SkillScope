# SkillScope

SkillScope summarizes HeadHunter vacancies across selected IT roles in Kyrgyzstan,
Kazakhstan and Uzbekistan. Its initial scope covers Data & AI, Software Engineering,
DevOps & Cloud, Cybersecurity and QA. The dashboard reports observed vacancy counts,
skill mentions, inferred seniority and published salary ranges.

The packaged demo snapshot still contains the previous four-role Data sample. Refresh
and review the collected dataset before treating expanded-role charts as market evidence.

## Run the dashboard

Requirements: Python 3.12 or newer.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[api]"
.\.venv\Scripts\python.exe -m skillscope.serve
```

Open `http://127.0.0.1:8000`. The app uses `data/processed/vacancies_latest.jsonl` when present; otherwise it serves the sanitized snapshot packaged with the project. The demo snapshot omits vacancy IDs, titles, employers, links and descriptions.

## Configuration

The dashboard works with demo data and does not need a HeadHunter token. Copy `.env.example` to `.env` only when collecting data:

```powershell
Copy-Item .env.example .env
```

Role categories, search phrases, title patterns and overlap priority live in
`src/skillscope/role_catalog.toml`. Skill aliases live in `config/skills.toml`.

| Variable | Purpose |
| --- | --- |
| `HH_USER_AGENT` | HeadHunter client identification; replace the example email with a contact email. |
| `HH_ACCESS_TOKEN` | Optional API token for collection; anonymous requests may be interrupted by captcha. |
| `HH_CLIENT_ID`, `HH_CLIENT_SECRET` | Credentials used by `python -m skillscope.auth` to obtain a token. |
| `HH_REQUEST_TIMEOUT_SECONDS` | Request timeout; default `20`. |
| `HH_MAX_RETRIES` | Maximum retries for temporary API failures; default `4`. |
| `HOST`, `PORT` | Web server bind address and port; defaults are `127.0.0.1` and `8000`. |

Never commit `.env`, raw API responses, full processed records or the local history database.

## Collect and process data

After setting a valid `HH_USER_AGENT` and HeadHunter credentials in `.env`:

```powershell
.\.venv\Scripts\python.exe -m skillscope.auth
.\.venv\Scripts\python.exe -m skillscope.collect
.\.venv\Scripts\python.exe -m skillscope.eda
.\.venv\Scripts\python.exe -m skillscope.demo_data
```

Collection writes raw and processed files locally. Review the generated demo snapshot before committing it. The generator uses an explicit field allowlist.

## Frontend development

Requirements: Node.js 22.18 or newer and pnpm. Run the API with `python -m skillscope.serve`, then in another terminal:

```powershell
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend dev
```

The Vite server runs the development UI and proxies `/api` to FastAPI. To update the dashboard bundle served by FastAPI:

```powershell
pnpm --dir frontend build
```

Commit the regenerated files in `src/skillscope/static` with the frontend changes.

The dashboard has four tabs: Overview, Roles & experience, Skills and Salaries. Shared
filters persist across tabs. Market Radar previews and pins skill frequencies and offers
keyboard navigation, a List view and reduced-motion support.

## Checks

Install Python development tools with `pip install -e ".[dev]"`, then run:

```powershell
python -m pytest
python -m ruff check src tests
python -m mypy src/skillscope
pnpm --dir frontend test
pnpm --dir frontend build
pnpm --dir frontend exec playwright install chromium
```

With the API server running, use `pnpm --dir frontend test:browser` and
`node frontend/tests/radar-interactions.cjs`. Set `PLAYWRIGHT_CHANNEL=chrome` to use
installed Chrome instead, or `SKILLSCOPE_URL` to check another local server.

## API

- `GET /api/overview`
- `GET /api/taxonomy`
- `GET /api/roles?market=kz&category=software_engineering`
- `GET /api/skills?market=kz&role=data_analyst`
- `GET /api/salaries`
- `GET /api/seniority`
- `GET /api/model-insights`

Interactive API documentation is available at `/docs`.

## Scope and limitations

- Search results are a HeadHunter snapshot, not a census of the regional labour market.
- Role counts describe vacancies returned by configured searches; they are not total
  market demand. Categories with few records should not be ranked as if samples were equal.
- Role and skill assignments use explicit rules and dictionaries.
- Seniority is inferred from titles, descriptions and experience bands.
- Salary values are sparse. Only complete local-currency ranges contribute a midpoint; currencies are not converted or pooled.
- No salary prediction model has been trained.

## Stack

Python, FastAPI, SQLite, React, TypeScript and Vite. The deployment configuration for Render is in `render.yaml`; see [deployment instructions](docs/deployment.md).
