from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.repairs import router as repairs_router
from app.api.vehicles import router as vehicles_router


api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(documents_router)
api_router.include_router(health_router, tags=["health"])
api_router.include_router(repairs_router)
api_router.include_router(vehicles_router)
