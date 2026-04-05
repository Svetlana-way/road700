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


def get_storage_root() -> Path:
    return STORAGE_ROOT


def set_storage_root(path: str | Path) -> Path:
    global STORAGE_ROOT
    STORAGE_ROOT = Path(path).resolve()
    return STORAGE_ROOT


def get_frontend_dist_dir() -> Path:
    return FRONTEND_DIST_DIR


def set_frontend_dist_dir(path: str | Path) -> Path:
    global FRONTEND_DIST_DIR
    FRONTEND_DIST_DIR = Path(path).resolve()
    return FRONTEND_DIST_DIR
