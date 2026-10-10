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

    async def test_taxonomy_preserves_data_roles_and_includes_new_fields(self) -> None:
        taxonomy = (await self._get("/api/taxonomy")).json()
        self.assertEqual(len(taxonomy), 5)
        self.assertEqual(sum(len(item["roles"]) for item in taxonomy), 10)
        data_roles = next(item["roles"] for item in taxonomy if item["code"] == "data_ai")
        self.assertEqual(
            {item["code"] for item in data_roles},
            {"data_analyst", "bi_analyst", "data_scientist", "ml_engineer"},
        )

    async def test_category_filters_support_legacy_records_and_unsampled_fields(self) -> None:
        skills = (await self._get("/api/skills", {"category": "data_ai"})).json()
        self.assertEqual(skills["vacancy_denominator"], 2)
        skills = (await self._get("/api/skills", {"category": "software_engineering"})).json()
        self.assertEqual(skills["vacancy_denominator"], 0)
        self.assertEqual(skills["items"], [])

        for endpoint in ("skills", "salaries", "seniority"):
            with self.subTest(endpoint=endpoint):
                response = await self._get(f"/api/{endpoint}", {"role": "unknown_role"})
                self.assertEqual(response.status_code, 422)
                response = await self._get(f"/api/{endpoint}", {"category": "unknown_field"})
                self.assertEqual(response.status_code, 422)

    async def test_role_demand_separates_experience_requirements_from_seniority(self) -> None:
        records = [
            {
                "market": "kz",
                "review_decision": "included",
                "role_family": "backend_developer",
                "experience": experience,
                "seniority": "Unknown",
            }
            for experience in ("noExperience", "between1And3", None)
        ]
        self.data_path.write_text(
            "".join(json.dumps(record) + "\n" for record in records), encoding="utf-8",
        )
        response = await self._get(
            "/api/roles", {"market": "kz", "category": "software_engineering"},
        )
        self.assertEqual(response.status_code, 200)
        demand = response.json()
        backend = next(item for item in demand["items"] if item["code"] == "backend_developer")
        self.assertEqual(demand["vacancy_denominator"], 3)
        self.assertEqual(backend["vacancies"], 3)
        self.assertEqual(backend["share"], 1.0)
        self.assertEqual(backend["experience_observed_vacancies"], 2)
        self.assertEqual(backend["no_experience_required"], 1)
        self.assertEqual(backend["no_experience_share"], 0.5)
        frontend = next(item for item in demand["items"] if item["code"] == "frontend_developer")
        self.assertEqual(frontend["vacancies"], 0)
        self.assertIsNone(frontend["no_experience_share"])

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
