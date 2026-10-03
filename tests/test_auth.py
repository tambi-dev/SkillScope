from __future__ import annotations

import json
import tempfile
import unittest
import urllib.parse
import urllib.request
from pathlib import Path

from skillscope.auth import (
    HHAuthenticationError,
    TokenResponse,
    request_application_token,
    update_env_value,
)


class AuthenticationTests(unittest.TestCase):
    def test_requests_client_credentials_token(self) -> None:
        def transport(request: urllib.request.Request, timeout: float) -> TokenResponse:
            fields = urllib.parse.parse_qs((request.data or b"").decode("ascii"))
            self.assertEqual(fields["grant_type"], ["client_credentials"])
            self.assertEqual(fields["client_id"], ["client-id"])
            self.assertEqual(fields["client_secret"], ["client-secret"])
            return TokenResponse(
                status=200,
                headers={},
                body=json.dumps({"access_token": "private-token"}).encode(),
            )

        token = request_application_token(
            client_id="client-id",
            client_secret="client-secret",
            user_agent="SkillScope/0.1 (test@skillscope.dev)",
            transport=transport,
        )

        self.assertEqual(token, "private-token")

    def test_rejects_missing_access_token(self) -> None:
        def transport(request: urllib.request.Request, timeout: float) -> TokenResponse:
            return TokenResponse(status=200, headers={}, body=b"{}")

        with self.assertRaisesRegex(HHAuthenticationError, "access_token"):
            request_application_token(
                client_id="client-id",
                client_secret="client-secret",
                user_agent="SkillScope/0.1 (test@skillscope.dev)",
                transport=transport,
            )

    def test_updates_env_without_duplicate_key(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text("HH_ACCESS_TOKEN=old\nOTHER=value\n", encoding="utf-8")

            update_env_value(path, "HH_ACCESS_TOKEN", "new")
            contents = path.read_text(encoding="utf-8")

        self.assertEqual(contents.count("HH_ACCESS_TOKEN="), 1)
        self.assertIn("HH_ACCESS_TOKEN=new", contents)
        self.assertIn("OTHER=value", contents)


if __name__ == "__main__":
    unittest.main()

