"""Run the SkillScope dashboard and read-only API on one local server."""

from __future__ import annotations

import os

import uvicorn


def main() -> None:
    uvicorn.run(
        "skillscope.api:app",
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
    )


if __name__ == "__main__":
    main()
