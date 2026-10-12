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

    async def _post(self, path: str, payload: dict[str, str]) -> httpx.Response:
        transport = httpx.ASGITransport(app=self.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(path, json=payload)

    async def test_ask_requires_server_key_and_valid_question(self) -> None:
        with patch.dict("os.environ", {}, clear=True):
            status = (await self._get("/api/ask/status")).json()
            self.assertFalse(status["available"])
            response = await self._post("/api/ask", {"question": "What skills?"})
            self.assertEqual(response.status_code, 503)
        response = await self._post("/api/ask", {"question": "x"})
        self.assertEqual(response.status_code, 422)

    async def test_ask_sends_only_aggregates_and_keeps_denominators(self) -> None:
        with patch.dict("os.environ", {"GROQ_API_KEY": "test-only"}), patch(
            "skillscope.api.ask_groq", return_value="SQL appears in 1 of 1 Data Analyst vacancies."
        ) as generate:
            response = await self._post("/api/ask", {
                "question": "Which skills for Data Analysts in Kyrgyzstan?",
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["sample_size"], 1)
        self.assertEqual(response.json()["source"], "market")
        evidence = generate.call_args.args[1]
        self.assertEqual(evidence["selected_vacancies"], 1)
        self.assertEqual(evidence["roles"][0]["top_skills"][0]["out_of"], 1)
        self.assertEqual(evidence["roles"][0]["seniority"]["Junior"], 0)
        self.assertNotIn("vacancy_id", json.dumps(evidence))
        self.assertNotIn("title", json.dumps(evidence))

    async def test_ask_project_question_has_no_vacancy_header_data(self) -> None:
        with patch.dict("os.environ", {"GROQ_API_KEY": "test-only"}), patch(
            "skillscope.api.ask_groq", return_value="Arsen created and operates SkillScope."
        ) as generate:
            response = await self._post("/api/ask", {
                "question": "Who is the owner of the website?",
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["source"], "project")
        self.assertEqual(response.json()["sample_size"], 0)
        self.assertIsNone(response.json()["snapshot_date"])
        self.assertEqual(generate.call_args.args[1], {})

    async def test_ask_does_not_invent_untracked_role_data(self) -> None:
        with patch.dict("os.environ", {"GROQ_API_KEY": "test-only"}), patch(
            "skillscope.api.ask_groq"
        ) as generate:
            response = await self._post("/api/ask", {"question": "What does a Data Engineer need?"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("outside SkillScope", response.json()["answer"])
        generate.assert_not_called()

    async def test_ask_abstains_for_empty_junior_subgroup(self) -> None:
        row = {
            "market": "kz", "review_decision": "included", "role_family": "data_analyst",
            "seniority": "Middle", "skills_normalized": ["SQL"],
        }
        self.data_path.write_text(json.dumps(row) + "\n", encoding="utf-8")
        with patch.dict("os.environ", {"GROQ_API_KEY": "test-only"}), patch(
            "skillscope.api.ask_groq"
        ) as generate:
            response = await self._post("/api/ask", {
                "question": "Which skills matter for a Junior Data Analyst in Kazakhstan?",
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["sample_size"], 0)
        self.assertIn("no reviewed Junior Data Analyst", response.json()["answer"])
        generate.assert_not_called()

    async def test_ask_keeps_country_salaries_in_local_currencies(self) -> None:
        rows = [
            {
                "market": market, "review_decision": "included",
                "role_family": "data_analyst", "seniority": "Unknown",
                "salary_from": midpoint - 100, "salary_to": midpoint + 100,
                "salary_midpoint_local": midpoint, "salary_currency": currency,
            }
            for market, midpoint, currency in (("kz", 500_000, "KZT"), ("uz", 5_000_000, "UZS"))
        ]
        self.data_path.write_text(
            "".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8"
        )
        with patch.dict("os.environ", {"GROQ_API_KEY": "test-only"}), patch(
            "skillscope.api.ask_groq",
            return_value="Salaries are published in different currencies.",
        ) as generate:
            response = await self._post("/api/ask", {
                "question": "How do salaries differ between countries?",
            })
        self.assertEqual(response.status_code, 200)
        evidence = generate.call_args.args[1]
        self.assertEqual({
            market["market"]: market["salary"][0]["currency"]
            for market in evidence["markets"] if market["salary"]
        }, {"Kazakhstan": "KZT", "Uzbekistan": "UZS"})

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

    async def test_one_sided_salary_amounts_remain_separate(self) -> None:
        records = [
            {
                "market": "ge",
                "review_decision": "included",
                "role_family": "qa_engineer",
                "salary_currency": "USD",
                "salary_from": 1_000 if index == 0 else None,
                "salary_to": 2_000 if index == 1 else None,
                "salary_midpoint_local": None,
            }
            for index in range(2)
        ]
        self.data_path.write_text(
            "".join(json.dumps(record) + "\n" for record in records), encoding="utf-8"
        )
        salary = (await self._get("/api/salaries", {"market": "ge"})).json()[0]
        self.assertEqual(salary["vacancies_with_reported_salary"], 2)
        self.assertEqual(salary["complete_salary_ranges"], 0)
        self.assertEqual(salary["from_only_count"], 1)
        self.assertEqual(salary["to_only_count"], 1)
        self.assertEqual(salary["median_from_only_local"], 1_000)
        self.assertEqual(salary["median_to_only_local"], 2_000)
        self.assertIsNone(salary["median_midpoint_local"])

    async def test_published_full_range_counts_without_stored_midpoint(self) -> None:
        self.data_path.write_text(json.dumps({
            "market": "ge",
            "review_decision": "included",
            "role_family": "qa_engineer",
            "salary_currency": "USD",
            "salary_from": 1_000,
            "salary_to": 2_000,
            "salary_midpoint_local": None,
        }) + "\n", encoding="utf-8")
        salary = (await self._get("/api/salaries", {"market": "ge"})).json()[0]
        self.assertEqual(salary["complete_salary_ranges"], 1)
        self.assertEqual(salary["median_range_from_local"], 1_000)
        self.assertEqual(salary["median_range_to_local"], 2_000)
        self.assertEqual(salary["median_midpoint_local"], 1_500)

    async def test_unknown_market_is_rejected(self) -> None:
        response = await self._get("/api/skills", {"market": "xx"})
        self.assertEqual(response.status_code, 422)

    async def test_new_markets_return_empty_samples_without_error(self) -> None:
        for market in ("tj", "tm", "ge", "ru"):
            with self.subTest(market=market):
                response = await self._get("/api/skills", {"market": market})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["vacancy_denominator"], 0)

    async def test_new_markets_support_filtered_analytics(self) -> None:
        records = [
            {
                "market": market,
                "review_decision": "included",
                "role_family": "qa_engineer",
                "seniority": "Junior",
                "skills_normalized": ["Python"],
                "salary_from": 1_000,
                "salary_to": 2_000,
                "salary_midpoint_local": 1_500,
                "salary_currency": currency,
            }
            for market, currency in (("tj", "TJS"), ("tm", "TMT"))
        ]
        self.data_path.write_text(
            "".join(json.dumps(record) + "\n" for record in records), encoding="utf-8"
        )
        for market, currency in (("tj", "TJS"), ("tm", "TMT")):
            with self.subTest(market=market):
                roles = (await self._get("/api/roles", {"market": market})).json()
                self.assertEqual(roles["vacancy_denominator"], 1)
                skills = (await self._get("/api/skills", {"market": market})).json()
                self.assertEqual(skills["items"][0]["skill"], "Python")
                salaries = (await self._get("/api/salaries", {"market": market})).json()
                self.assertEqual(salaries[0]["currency"], currency)
                self.assertEqual(salaries[0]["from_only_count"], 0)
                self.assertEqual(salaries[0]["to_only_count"], 0)
                self.assertEqual(salaries[0]["median_midpoint_local"], 1_500)

    async def test_overview_keeps_collection_date_for_excluded_only_run(self) -> None:
        self.data_path.write_text(json.dumps({
            "market": "tm",
            "review_decision": "excluded",
            "collected_at": "2026-10-10T08:00:00+00:00",
        }) + "\n", encoding="utf-8")
        overview = (await self._get("/api/overview")).json()
        self.assertEqual(overview["included_vacancies"], 0)
        self.assertEqual(overview["last_seen_at"], "2026-10-10T08:00:00+00:00")

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
        self.assertEqual(overview["candidate_vacancies"], 2541)
        self.assertEqual(overview["included_vacancies"], 2297)
        self.assertIn("ge", overview["markets"])
        self.assertIn("ru", overview["markets"])
        self.assertEqual(len(overview["role_counts"]), 10)

    async def test_serves_built_dashboard_from_api_server(self) -> None:
        response = await self._get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("SkillScope", response.text)

        privacy_response = await self._get("/privacy")
        self.assertEqual(privacy_response.status_code, 200)
        self.assertIn("SkillScope", privacy_response.text)


if __name__ == "__main__":
    unittest.main()
