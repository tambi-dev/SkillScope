from __future__ import annotations

import io
import json
from unittest.mock import patch

from skillscope.ask import ask_groq, is_project_question


def test_groq_request_uses_supported_reasoning_parameters() -> None:
    response = io.BytesIO(b'{"choices":[{"message":{"content":"SQL: 1 of 1."}}]}')
    with patch("skillscope.ask.urlopen") as open_url:
        open_url.return_value.__enter__.return_value = response
        answer = ask_groq("Which skills?", {"selected_vacancies": 1}, "test-only")

    payload = json.loads(open_url.call_args.args[0].data)
    request = open_url.call_args.args[0]
    assert answer == "SQL: 1 of 1."
    assert request.get_header("User-agent") == "SkillScope/0.1.0"
    assert payload["model"] == "openai/gpt-oss-20b"
    assert payload["reasoning_effort"] == "low"
    assert payload["include_reasoning"] is False
    assert "reasoning_format" not in payload


def test_russian_owner_question_uses_project_facts() -> None:
    assert is_project_question("Кто владелец сайта?")
