from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from skillscope.config import load_markets, load_role_queries


class ConfigTests(unittest.TestCase):
    def test_project_config_covers_seven_markets(self) -> None:
        path = Path(__file__).resolve().parents[1] / "config" / "markets.toml"
        markets = {market.code: market for market in load_markets(path)}
        self.assertEqual(set(markets), {"kg", "kz", "uz", "tj", "tm", "ge", "ru"})
        self.assertEqual((markets["tj"].area_id, markets["tj"].host), ("86", "hh.ru"))
        self.assertEqual((markets["tm"].area_id, markets["tm"].host), ("93", "hh.ru"))
        self.assertEqual(
            (markets["ge"].area_id, markets["ge"].host, markets["ge"].currency),
            ("28", "headhunter.ge", "GEL"),
        )
        self.assertEqual(
            (markets["ru"].area_id, markets["ru"].host, markets["ru"].currency),
            ("113", "hh.ru", "RUB"),
        )

    def test_loads_enabled_markets_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "markets.toml"
            path.write_text(
                """
[markets.kg]
name = "Kyrgyzstan"
host = "headhunter.kg"
area_id = "48"
currency = "KGS"
enabled = true

[markets.kz]
name = "Kazakhstan"
host = "hh.kz"
area_id = "40"
currency = "KZT"
enabled = false
""".strip(),
                encoding="utf-8",
            )

            markets = load_markets(path)

        self.assertEqual([market.code for market in markets], ["kg"])
        self.assertEqual(markets[0].area_id, "48")

    def test_rejects_role_without_queries(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "roles.toml"
            path.write_text('[roles.data_analyst]\nlabel = "Data Analyst"\n', encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "non-empty queries"):
                load_role_queries(path)


if __name__ == "__main__":
    unittest.main()

