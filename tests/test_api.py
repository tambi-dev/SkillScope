from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

from skillscope.api import create_app


class ApiTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_path = Path(self.temp_dir.name) / "vacancies.jsonl"
        records = [
            {
                "vacancy_id": "kg-1",
                "market": "kg",
                "title": "Data Analyst",
                "review_decision": "included",
                "role_family": "data_analyst",
                "seniority": "Unknown",
                "last_seen_at": "2026-10-01T08:00:00+00:00",
                "skills_normalized": ["SQL", "Python"],
                "salary_from": None,
                "salary_to": None,
                "salary_midpoint_local": None,
                "salary_currency": None,
            },
            {
                "vacancy_id": "kz-1",
                "market": "kz",
                "title": "Senior Data Scientist",
                "review_decision": "included",
                "role_family": "data_scientist",
                "seniority": "Senior",
                "last_seen_at": "2026-10-01T08:00:00+00:00",
                "skills_normalized": ["Python", "Machine Learning"],
                "salary_from": 900000,
                "salary_to": 1100000,
                "salary_midpoint_local": 1000000,
                "salary_currency": "KZT",
            },
            {
                "vacancy_id": "uz-1",
                "market": "uz",
                "title": "Data Analyst Instructor",
                "review_decision": "excluded",
                "role_family": None,
                "seniority": "Unknown",
                "last_seen_at": "2026-10-01T08:00:00+00:00",
                "skills_normalized": ["SQL"],
                "salary_from": None,
                "salary_to": None,
                "salary_midpoint_local": None,
                "salary_currency": None,
            },
        ]
        self.data_path.write_text(
            "".join(json.dumps(record) + "\n" for record in records),
            encoding="utf-8",
        )
        self.app = create_app(self.data_path)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    async def _get(self, path: str, params: dict[str, str] | None = None) -> httpx.Response:
        transport = httpx.ASGITransport(app=self.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get(path, params=params)

    async def test_overview_and_filtered_skills(self) -> None:
        overview = (await self._get("/api/overview")).json()
        self.assertEqual(overview["candidate_vacancies"], 3)
        self.assertEqual(overview["included_vacancies"], 2)
        self.assertEqual(overview["excluded_candidates"], 1)
        self.assertEqual(overview["data_mode"], "processed")

        skills = (await self._get("/api/skills", {"market": "kg"})).json()
        self.assertEqual(skills["vacancy_denominator"], 1)
        self.assertEqual(skills["items"][0]["skill"], "Python")
        self.assertEqual(skills["items"][0]["share"], 1.0)

    async def test_missing_salary_stays_null_and_model_is_not_ready(self) -> None:
        salaries = (await self._get("/api/salaries", {"market": "kg"})).json()
        self.assertEqual(salaries[0]["vacancies_with_reported_salary"], 0)
        self.assertEqual(salaries[0]["median_midpoint_local"], None)

        insights = (await self._get("/api/model-insights")).json()
        self.assertEqual(insights["status"], "not_ready")
        self.assertFalse(insights["imputation_used"])
        self.assertEqual(insights["complete_salary_ranges"], 1)

    async def test_unknown_market_is_rejected(self) -> None:
        response = await self._get("/api/skills", {"market": "ru"})
        self.assertEqual(response.status_code, 422)

    async def test_demo_snapshot_supports_clean_checkout(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        demo_path = project_root / "src" / "skillscope" / "demo_vacancies.jsonl"
        with patch("skillscope.api._default_data_path", return_value=demo_path):
            demo_app = create_app()
        transport = httpx.ASGITransport(app=demo_app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/overview")

        self.assertEqual(response.status_code, 200)
        overview = response.json()
        self.assertEqual(overview["data_mode"], "demo")
        self.assertEqual(overview["candidate_vacancies"], 95)
        self.assertEqual(overview["included_vacancies"], 84)

    async def test_serves_built_dashboard_from_api_server(self) -> None:
        response = await self._get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("SkillScope", response.text)


if __name__ == "__main__":
    unittest.main()
