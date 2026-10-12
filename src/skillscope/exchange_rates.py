"""Save exchange rates alongside a vacancy snapshot."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.request import urlopen


def refresh_exchange_rates(project_root: Path, snapshot_date: str) -> None:
    currencies = ("EUR", "GEL", "KGS", "KZT", "RUB", "TJS", "TMT", "UZS")
    url = (
        "https://api.frankfurter.dev/v2/rates"
        f"?date={snapshot_date}&base=USD&quotes={','.join(currencies)}"
    )
    with urlopen(url, timeout=15) as response:
        rows = json.load(response)
    rates = {
        row["quote"]: row["rate"] for row in rows
        if row.get("date") == snapshot_date
        and row.get("base") == "USD"
        and row.get("quote") in currencies
        and isinstance(row.get("rate"), (int, float))
        and row["rate"] > 0
    }
    if set(rates) != set(currencies):
        raise ValueError("Missing or mismatched exchange rates")
    path = project_root / "src" / "skillscope" / "exchange_rates.json"
    path.write_text(json.dumps({
        "date": snapshot_date,
        "source": "Frankfurter",
        "rates_per_usd": {"USD": 1, **rates},
    }, indent=2) + "\n", encoding="utf-8")
