"""Safely obtain and store a HeadHunter application access token."""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path

from skillscope.config import Settings


class HHAuthenticationError(RuntimeError):
    """Raised when application authentication fails."""


@dataclass(frozen=True, slots=True)
class TokenResponse:
    status: int
    headers: Mapping[str, str]
    body: bytes


TokenTransport = Callable[[urllib.request.Request, float], TokenResponse]


def request_application_token(
    *,
    client_id: str,
    client_secret: str,
    user_agent: str,
    timeout_seconds: float = 20,
    transport: TokenTransport | None = None,
) -> str:
    """Exchange client credentials for a token without logging credentials."""

    if not client_id or not client_secret:
        raise HHAuthenticationError("HH_CLIENT_ID and HH_CLIENT_SECRET are required")
    body = urllib.parse.urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }
    ).encode("ascii")
    request = urllib.request.Request(
        "https://api.hh.ru/token",
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "HH-User-Agent": user_agent,
            "User-Agent": user_agent,
        },
        method="POST",
    )
    response = (transport or _urllib_transport)(request, timeout_seconds)
    if response.status != 200:
        message = _safe_error_message(response.body)
        raise HHAuthenticationError(f"HH token endpoint returned HTTP {response.status}: {message}")
    try:
        payload = json.loads(response.body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise HHAuthenticationError("HH token endpoint returned invalid JSON") from error
    token = payload.get("access_token") if isinstance(payload, dict) else None
    if not isinstance(token, str) or not token:
        raise HHAuthenticationError("HH token response does not contain access_token")
    return token


def update_env_value(path: Path, key: str, value: str) -> None:
    """Atomically replace one .env value without printing it."""

    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    prefix = f"{key}="
    updated: list[str] = []
    replaced = False
    for line in lines:
        if line.startswith(prefix):
            updated.append(f"{prefix}{value}")
            replaced = True
        else:
            updated.append(line)
    if not replaced:
        updated.append(f"{prefix}{value}")
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text("\n".join(updated) + "\n", encoding="utf-8")
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    settings = Settings.from_environment()
    if not settings.hh_client_id or not settings.hh_client_secret:
        parser.error("Set HH_CLIENT_ID and HH_CLIENT_SECRET in .env first")
    try:
        token = request_application_token(
            client_id=settings.hh_client_id,
            client_secret=settings.hh_client_secret,
            user_agent=settings.hh_user_agent,
            timeout_seconds=settings.request_timeout_seconds,
        )
        update_env_value(settings.project_root / ".env", "HH_ACCESS_TOKEN", token)
    except (HHAuthenticationError, OSError, urllib.error.URLError) as error:
        parser.error(str(error))
    print("HeadHunter application token saved to the gitignored .env file.")


def _urllib_transport(request: urllib.request.Request, timeout: float) -> TokenResponse:
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return TokenResponse(
                status=response.status,
                headers=dict(response.headers.items()),
                body=response.read(),
            )
    except urllib.error.HTTPError as error:
        return TokenResponse(
            status=error.code,
            headers=dict(error.headers.items()) if error.headers else {},
            body=error.read(),
        )


def _safe_error_message(body: bytes) -> str:
    """Return an API error description while avoiding credential echoing."""

    try:
        payload = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return "authentication failed"
    if isinstance(payload, dict):
        description = payload.get("description") or payload.get("error_description")
        if isinstance(description, str):
            return description[:300]
        error = payload.get("error")
        if isinstance(error, str):
            return error[:100]
    return "authentication failed"


if __name__ == "__main__":
    main()

