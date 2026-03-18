from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.imports import router as imports_router
from app.api.labor_norms import router as labor_norms_router
from app.api.ocr_learning import router as ocr_learning_router
from app.api.ocr_rules import router as ocr_rules_router
from app.api.ocr_profile_matchers import router as ocr_profile_matchers_router
from app.api.repairs import router as repairs_router
from app.api.review import router as review_router
from app.api.services import router as services_router
from app.api.system import router as system_router
from app.api.users import router as users_router
from app.api.vehicles import router as vehicles_router


api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(documents_router)
api_router.include_router(health_router, tags=["health"])
api_router.include_router(imports_router)
api_router.include_router(labor_norms_router)
api_router.include_router(ocr_learning_router)
api_router.include_router(ocr_profile_matchers_router)
api_router.include_router(ocr_rules_router)
api_router.include_router(repairs_router)
api_router.include_router(review_router)
api_router.include_router(services_router)
api_router.include_router(system_router)
api_router.include_router(users_router)
api_router.include_router(vehicles_router)
