from __future__ import annotations

import os
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]


def detect_project_root() -> Path:
    override = os.getenv("ROAD700_PROJECT_ROOT")
    if override:
        return Path(override).resolve()

    repo_candidate = BACKEND_ROOT.parent
    if (repo_candidate / "backend").exists() and (repo_candidate / "frontend").exists():
        return repo_candidate

    return BACKEND_ROOT


PROJECT_ROOT = detect_project_root()
STORAGE_ROOT = Path(os.getenv("ROAD700_STORAGE_ROOT", str(PROJECT_ROOT / "storage"))).resolve()
FRONTEND_DIST_DIR = Path(os.getenv("ROAD700_FRONTEND_DIST", str(PROJECT_ROOT / "frontend" / "dist"))).resolve()
