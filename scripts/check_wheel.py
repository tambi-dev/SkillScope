"""Smoke-test a built wheel without relying on editable source or private data."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

CHECK = """
import asyncio
import re
from pathlib import Path
import httpx
import skillscope
from skillscope.api import app

assert Path(skillscope.__file__).is_relative_to(Path.cwd()), skillscope.__file__

async def check():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        overview = await client.get('/api/overview')
        assert overview.status_code == 200
        assert overview.json()['data_mode'] == 'demo'
        assert overview.json()['included_vacancies'] > 0
        page = await client.get('/')
        assert page.status_code == 200
        assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', page.text)
        assert assets
        for asset in assets:
            response = await client.get(asset)
            assert response.status_code == 200, asset
    print('PASS: wheel serves the demo, page and linked assets without private files.')

asyncio.run(check())
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("wheel", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="skillscope-wheel-") as temporary:
        # The input is the wheel just built from this repository.
        with zipfile.ZipFile(args.wheel) as archive:
            archive.extractall(temporary)
        environment = os.environ.copy()
        environment["PYTHONPATH"] = temporary
        subprocess.run(
            [sys.executable, "-c", CHECK], cwd=temporary, env=environment, check=True,
        )


if __name__ == "__main__":
    main()
