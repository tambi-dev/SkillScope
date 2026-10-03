"""Small, dependency-free HeadHunter API client with bounded retries."""

from __future__ import annotations

import json
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any


class HHApiError(RuntimeError):
    """Raised when the HeadHunter API cannot return a usable response."""


@dataclass(frozen=True, slots=True)
class TransportResponse:
    status: int
    headers: Mapping[str, str]
    body: bytes


Transport = Callable[[urllib.request.Request, float], TransportResponse]


class HHClient:
    base_url = "https://api.hh.ru"
    retryable_statuses = frozenset({429, 500, 502, 503, 504})

    def __init__(
        self,
        *,
        user_agent: str,
        access_token: str | None = None,
        timeout_seconds: float = 20,
        max_retries: int = 4,
        transport: Transport | None = None,
        sleep: Callable[[float], None] = time.sleep,
        random_uniform: Callable[[float, float], float] = random.uniform,
    ) -> None:
        normalized_user_agent = user_agent.casefold()
        if "@" not in user_agent or "example.com" in normalized_user_agent:
            raise ValueError(
                "HH_USER_AGENT must contain a real developer contact email, not example.com"
            )
        self.user_agent = user_agent
        self.access_token = access_token
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self._transport = transport or _urllib_transport
        self._sleep = sleep
        self._random_uniform = random_uniform

    def search_vacancies(
        self,
        *,
        text: str,
        area_id: str,
        host: str,
        page: int,
        per_page: int = 100,
        search_field: str = "name",
        exact_title_terms: bool = True,
    ) -> dict[str, Any]:
        if not 0 <= page:
            raise ValueError("page must be non-negative")
        if not 1 <= per_page <= 100:
            raise ValueError("per_page must be between 1 and 100")
        search_text = _exact_title_expression(text) if exact_title_terms else text
        query = {
            "text": search_text,
            "area": area_id,
            "host": host,
            "page": str(page),
            "per_page": str(per_page),
            "search_field": search_field,
        }
        if exact_title_terms:
            query["no_magic"] = "true"
        return self._get_json("/vacancies", query)

    def get_vacancy(self, vacancy_id: str, *, host: str) -> dict[str, Any]:
        """Return the full representation of one vacancy."""

        normalized_id = vacancy_id.strip()
        if not normalized_id or not normalized_id.isdigit():
            raise ValueError("vacancy_id must contain digits only")
        return self._get_json(f"/vacancies/{normalized_id}", {"host": host})

    def _get_json(self, path: str, query: Mapping[str, str]) -> dict[str, Any]:
        encoded_query = urllib.parse.urlencode(query)
        request = urllib.request.Request(
            f"{self.base_url}{path}?{encoded_query}",
            headers=self._headers(),
            method="GET",
        )

        for attempt in range(self.max_retries + 1):
            try:
                response = self._transport(request, self.timeout_seconds)
            except (TimeoutError, urllib.error.URLError) as error:
                if attempt >= self.max_retries:
                    message = f"Network failure after {attempt + 1} attempts: {error}"
                    raise HHApiError(message) from error
                self._sleep(self._backoff_seconds(attempt, None))
                continue

            if response.status == 200:
                return _decode_json(response.body)
            if response.status == 403 and not self.access_token:
                raise HHApiError(
                    "HH API rejected anonymous access (HTTP 403). "
                    "Set HH_ACCESS_TOKEN in .env using a HeadHunter application token."
                )
            if response.status not in self.retryable_statuses or attempt >= self.max_retries:
                message = response.body.decode("utf-8", errors="replace")[:500]
                raise HHApiError(f"HH API returned HTTP {response.status}: {message}")
            self._sleep(self._backoff_seconds(attempt, response.headers.get("Retry-After")))

        raise AssertionError("Retry loop terminated unexpectedly")

    def _headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "HH-User-Agent": self.user_agent,
            "User-Agent": self.user_agent,
        }
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    def _backoff_seconds(self, attempt: int, retry_after: str | None) -> float:
        if retry_after:
            try:
                return max(0.0, float(retry_after))
            except ValueError:
                pass
        return min(30.0, (2**attempt) + self._random_uniform(0.0, 0.5))


def _urllib_transport(request: urllib.request.Request, timeout: float) -> TransportResponse:
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return TransportResponse(
                status=response.status,
                headers=dict(response.headers.items()),
                body=response.read(),
            )
    except urllib.error.HTTPError as error:
        return TransportResponse(
            status=error.code,
            headers=dict(error.headers.items()) if error.headers else {},
            body=error.read(),
        )


def _decode_json(body: bytes) -> dict[str, Any]:
    try:
        payload = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise HHApiError("HH API returned invalid JSON") from error
    if not isinstance(payload, dict):
        raise HHApiError("HH API returned a non-object JSON payload")
    return payload


def _exact_title_expression(text: str) -> str:
    terms = re.findall(r"[A-Za-zА-Яа-яЁё0-9]+", text)
    if not terms:
        raise ValueError("Search text must contain at least one alphanumeric term")
    exact_terms = " AND ".join(f"!{term}" for term in terms)
    return f"NAME:({exact_terms})"
