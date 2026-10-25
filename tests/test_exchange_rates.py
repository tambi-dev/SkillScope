"""The weekly collection saves a complete, dated conversion snapshot."""

import io
import json

import pytest

from skillscope import exchange_rates


def test_refresh_exchange_rates_saves_complete_snapshot(tmp_path, monkeypatch):
    currencies = ("EUR", "GEL", "KGS", "KZT", "RUB", "TJS", "TMT", "UZS")
    rows = [
        {"date": "2026-10-12", "base": "USD", "quote": currency, "rate": index + 2}
        for index, currency in enumerate(currencies)
    ]
    def fake_urlopen(request, *, timeout):
        assert request.get_header("User-agent") == "SkillScope/0.1 (research project)"
        return io.BytesIO(json.dumps(rows).encode())

    monkeypatch.setattr(exchange_rates, "urlopen", fake_urlopen)
    output = tmp_path / "src" / "skillscope"
    output.mkdir(parents=True)

    exchange_rates.refresh_exchange_rates(tmp_path, "2026-10-12")

    result = json.loads((output / "exchange_rates.json").read_text(encoding="utf-8"))
    assert result["date"] == "2026-10-12"
    expected = {currency: index + 2 for index, currency in enumerate(currencies)}
    assert result["rates_per_usd"] == {"USD": 1, **expected}


def test_refresh_exchange_rates_rejects_incomplete_snapshot(tmp_path, monkeypatch):
    monkeypatch.setattr(exchange_rates, "urlopen", lambda *_args, **_kwargs: io.BytesIO(b"[]"))
    output = tmp_path / "src" / "skillscope"
    output.mkdir(parents=True)

    with pytest.raises(ValueError, match="Missing or mismatched"):
        exchange_rates.refresh_exchange_rates(tmp_path, "2026-10-12")

    assert not (output / "exchange_rates.json").exists()
