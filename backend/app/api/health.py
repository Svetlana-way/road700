from __future__ import annotations

import tempfile

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from app.core.config import settings
from app.core.paths import get_storage_root
from app.db.session import engine
from app.services.ocr_runtime import get_ocr_runtime_status


router = APIRouter()


@router.get("/health")
def healthcheck() -> dict[str, object]:
    checks: dict[str, str] = {}

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "error", "dependency": "database", "message": str(exc)},
        ) from exc

    try:
        storage_root = get_storage_root()
        storage_root.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=storage_root, prefix=".healthcheck-", delete=True):
            pass
        checks["storage"] = "ok"
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "error", "dependency": "storage", "message": str(exc)},
        ) from exc

    ocr_runtime = get_ocr_runtime_status()
    checks["ocr_backend"] = str(ocr_runtime["ocr_backend"] or "missing")
    checks["pdf_renderer"] = str(ocr_runtime["pdf_renderer"] or "missing")
    checks["image_ocr"] = "ok" if bool(ocr_runtime["image_ocr_available"]) else "degraded"
    checks["pdf_scan_ocr"] = "ok" if bool(ocr_runtime["pdf_scan_ocr_available"]) else "degraded"

    return {
        "status": "ok",
        "service": settings.project_name,
        "version": "0.1.0",
        "checks": checks,
    }
