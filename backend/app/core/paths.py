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


def get_backend_data_root() -> Path:
    override = os.getenv("ROAD700_BACKEND_DATA_ROOT")
    if override:
        return Path(override).expanduser().resolve()

    candidates: list[Path] = []
    for candidate in (
        PROJECT_ROOT / "data",
        PROJECT_ROOT / "backend" / "data",
        BACKEND_ROOT / "data",
    ):
        resolved = candidate.resolve()
        if resolved not in candidates:
            candidates.append(resolved)

    for candidate in candidates:
        if candidate.exists():
            return candidate

    if (PROJECT_ROOT / "backend").exists():
        return (PROJECT_ROOT / "backend" / "data").resolve()
    return (BACKEND_ROOT / "data").resolve()


def resolve_user_path(path: str | Path) -> Path:
    return Path(path).expanduser().resolve()


def resolve_storage_path(storage_key: str | Path, *, storage_root: str | Path | None = None) -> Path | None:
    root = Path(storage_root) if storage_root is not None else get_storage_root()
    resolved_root = root.resolve()
    candidate = (resolved_root / storage_key).resolve()
    try:
        candidate.relative_to(resolved_root)
    except ValueError:
        return None
    return candidate


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
