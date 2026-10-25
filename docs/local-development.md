# Local development

Run these commands from the repository root in PowerShell. Python 3.12 or newer
is required.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[api]"
.\.venv\Scripts\python.exe -m skillscope.serve
```

Open <http://127.0.0.1:8000>. The API documentation is at
<http://127.0.0.1:8000/docs>. The app uses
`data/processed/vacancies_latest.jsonl` when present; otherwise it serves the
packaged anonymised demo snapshot. Viewing the dashboard needs no HeadHunter
token.

For frontend development, install Node.js 22.18 or newer and pnpm. Keep the
Python server running in another terminal:

```powershell
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend dev
```

Vite proxies `/api` to FastAPI. Run `pnpm --dir frontend build` to update the
bundle in `src/skillscope/static` that FastAPI serves.

To collect new data, configure `.env` and follow the
[weekly collection guide](weekly-collection.md). Review the anonymised export
before committing and deploying it. Keep credentials, raw responses, full
processed records and the local SQLite database out of Git. See the
[deployment guide](deployment.md) for the public site.
