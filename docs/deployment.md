# Public demo on Render

The repository contains `render.yaml` for one free Python web service. FastAPI serves
the bundled React files and aggregate API. The build installs `.[api]`; the start
command is `python -m skillscope.serve`. `HOST=0.0.0.0` accepts platform traffic and
Render supplies `PORT`. `.python-version` selects Python 3.12.

## First deployment

1. Put the project in your own GitHub repository, including
   `src/skillscope/static` and `src/skillscope/demo_vacancies.jsonl`.
2. In Render, select **New → Blueprint**, connect that repository and use the root
   `render.yaml`. Confirm that the proposed service uses the **Free** compute plan.
3. After deployment, open the generated HTTPS URL. Check the dashboard, a country
   filter, and `/api/overview`. The overview should report `data_mode: demo`.
4. Add the actual working URL to the top of README and the application portfolio.

Deployment has not been performed yet. No URL or account connection is assumed.

## What is deployed

The bundled demonstration snapshot contains derived analytical fields, with vacancy
IDs, titles, employer names, URLs and descriptions removed. The web service needs no
HeadHunter token and does not collect vacancies. Refresh data locally, review the
demo export, and redeploy it when ready. The data card's publication review still
applies to the derived dataset.

Do not upload `.env`, raw responses, full processed records or the local history
database. The project `.gitignore` excludes these. Git-ignored files previously
committed to a repository still need to be removed from tracking before publishing.

## Updating the interface

Run `pnpm --dir frontend install --frozen-lockfile`, `pnpm --dir frontend test` and
`pnpm --dir frontend build` (Node 22.18+). Include the regenerated
`src/skillscope/static` files with the source changes. The Render build uses this
bundle and does not install Node.

The readiness check uses `/api/overview`, so a missing or unreadable snapshot makes
the deployment unhealthy. Render's free service can sleep after 15 minutes of
inactivity and take about a minute to resume. Decide whether that delay is acceptable
before sharing the admissions link; paid compute is a separate optional decision.

Sources: [Render Blueprint specification](https://render.com/docs/blueprint-spec),
[Python versions](https://render.com/docs/python-version),
[free service limitations](https://render.com/docs/free).
