from fastapi import APIRouter, Depends

from app.api.deps import get_current_admin
from app.models.user import User
from app.services.document_processing import get_ocr_runtime_status
from app.services.email_delivery import is_email_delivery_configured


router = APIRouter(prefix="/system", tags=["system"])


@router.get("/status")
def system_status(current_admin: User = Depends(get_current_admin)) -> dict[str, object]:
    _ = current_admin
    ocr_runtime = get_ocr_runtime_status()
    return {
        "password_recovery_delivery_mode": "email" if is_email_delivery_configured() else "manual",
        "password_recovery_email_configured": is_email_delivery_configured(),
        "ocr_backend": ocr_runtime["ocr_backend"],
        "pdf_renderer": ocr_runtime["pdf_renderer"],
        "image_ocr_available": ocr_runtime["image_ocr_available"],
        "pdf_scan_ocr_available": ocr_runtime["pdf_scan_ocr_available"],
        "vision_available": ocr_runtime["vision_available"],
        "tesseract_available": ocr_runtime["tesseract_available"],
        "pdftoppm_available": ocr_runtime["pdftoppm_available"],
        "sips_available": ocr_runtime["sips_available"],
    }
