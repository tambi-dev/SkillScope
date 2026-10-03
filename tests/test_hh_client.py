from __future__ import annotations

import json
import unittest
import urllib.parse
import urllib.request

from skillscope.ingestion.hh_client import HHApiError, HHClient, TransportResponse


class HHClientTests(unittest.TestCase):
    def test_retries_429_and_honours_retry_after(self) -> None:
        responses = iter(
            [
                TransportResponse(status=429, headers={"Retry-After": "2"}, body=b"{}"),
                TransportResponse(
                    status=200,
                    headers={},
                    body=json.dumps({"found": 0, "pages": 0, "items": []}).encode(),
                ),
            ]
        )
        sleeps: list[float] = []

        def transport(
            request: urllib.request.Request, timeout: float
        ) -> TransportResponse:
            self.assertEqual(timeout, 5)
            parameters = urllib.parse.parse_qs(urllib.parse.urlparse(request.full_url).query)
            self.assertEqual(parameters["area"], ["48"])
            self.assertEqual(parameters["no_magic"], ["true"])
            self.assertEqual(parameters["text"], ["NAME:(!data AND !analyst)"])
            return next(responses)

        client = HHClient(
            user_agent="SkillScope/0.1 (test@skillscope.dev)",
            timeout_seconds=5,
            transport=transport,
            sleep=sleeps.append,
        )

        result = client.search_vacancies(
            text="data analyst", area_id="48", host="headhunter.kg", page=0
        )

        self.assertEqual(result["found"], 0)
        self.assertEqual(sleeps, [2.0])

    def test_broad_search_allows_api_synonym_expansion(self) -> None:
        def transport(
            request: urllib.request.Request, timeout: float
        ) -> TransportResponse:
            parameters = urllib.parse.parse_qs(urllib.parse.urlparse(request.full_url).query)
            self.assertEqual(parameters["text"], ["data analyst"])
            self.assertNotIn("no_magic", parameters)
            return TransportResponse(
                status=200,
                headers={},
                body=b'{"found":0,"pages":0,"items":[]}',
            )

        client = HHClient(
            user_agent="SkillScope/0.1 (test@skillscope.dev)", transport=transport
        )

        client.search_vacancies(
            text="data analyst",
            area_id="48",
            host="headhunter.kg",
            page=0,
            exact_title_terms=False,
        )

    def test_raises_for_non_retryable_response(self) -> None:
        def transport(
            request: urllib.request.Request, timeout: float
        ) -> TransportResponse:
            return TransportResponse(status=400, headers={}, body=b'{"description":"bad"}')

        client = HHClient(
            user_agent="SkillScope/0.1 (test@skillscope.dev)", transport=transport
        )

        with self.assertRaisesRegex(HHApiError, "HTTP 400"):
            client.search_vacancies(
                text="data analyst", area_id="48", host="headhunter.kg", page=0
            )

    def test_requires_contact_in_user_agent(self) -> None:
        with self.assertRaisesRegex(ValueError, "real developer contact email"):
            HHClient(user_agent="SkillScope/0.1")

        with self.assertRaisesRegex(ValueError, "not example.com"):
            HHClient(user_agent="SkillScope/0.1 (your-email@example.com)")

    def test_rejects_search_without_terms(self) -> None:
        client = HHClient(user_agent="SkillScope/0.1 (test@skillscope.dev)")

        with self.assertRaisesRegex(ValueError, "alphanumeric term"):
            client.search_vacancies(
                text="---", area_id="48", host="headhunter.kg", page=0
            )

    def test_explains_anonymous_403(self) -> None:
        def transport(
            request: urllib.request.Request, timeout: float
        ) -> TransportResponse:
            return TransportResponse(status=403, headers={}, body=b'{"type":"forbidden"}')

        client = HHClient(
            user_agent="SkillScope/0.1 (test@skillscope.dev)", transport=transport
        )

        with self.assertRaisesRegex(HHApiError, "HH_ACCESS_TOKEN"):
            client.search_vacancies(
                text="data analyst", area_id="48", host="headhunter.kg", page=0
            )

    def test_gets_full_vacancy_by_id(self) -> None:
        def transport(
            request: urllib.request.Request, timeout: float
        ) -> TransportResponse:
            parsed = urllib.parse.urlparse(request.full_url)
            self.assertEqual(parsed.path, "/vacancies/123")
            self.assertEqual(urllib.parse.parse_qs(parsed.query)["host"], ["headhunter.kg"])
            return TransportResponse(status=200, headers={}, body=b'{"id":"123"}')

        client = HHClient(
            user_agent="SkillScope/0.1 (test@skillscope.dev)", transport=transport
        )

        self.assertEqual(client.get_vacancy("123", host="headhunter.kg")["id"], "123")

    def test_rejects_invalid_vacancy_id(self) -> None:
        client = HHClient(user_agent="SkillScope/0.1 (test@skillscope.dev)")

        with self.assertRaisesRegex(ValueError, "digits only"):
            client.get_vacancy("../../token", host="headhunter.kg")


if __name__ == "__main__":
    unittest.main()
