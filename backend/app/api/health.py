from fastapi import APIRouter

from app.core.config import settings


router = APIRouter()


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.project_name,
        "version": "0.1.0",
    }

