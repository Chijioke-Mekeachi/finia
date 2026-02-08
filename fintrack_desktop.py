"""
Convenience launcher when running from the `frontend/` directory:
  python3 -m fintrack_desktop

It prepends the repo root to `sys.path` and then launches the desktop app.
"""

from __future__ import annotations

import sys
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


sys.path.insert(0, str(_repo_root()))

from desktop.fintrack_desktop.app import main  # noqa: E402


if __name__ == "__main__":
    raise SystemExit(main())

