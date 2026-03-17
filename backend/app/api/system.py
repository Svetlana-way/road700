from fastapi import APIRouter, Depends

from app.api.deps import get_current_admin
from app.models.user import User
from app.services.email_delivery import is_email_delivery_configured


router = APIRouter(prefix="/system", tags=["system"])


@router.get("/status")
def system_status(current_admin: User = Depends(get_current_admin)) -> dict[str, object]:
    _ = current_admin
    return {
        "password_recovery_delivery_mode": "email" if is_email_delivery_configured() else "manual",
        "password_recovery_email_configured": is_email_delivery_configured(),
    }
