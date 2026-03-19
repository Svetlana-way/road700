from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings


IMAGE_SUFFIXES = {
    ".bmp",
    ".gif",
    ".heic",
    ".heif",
    ".jpeg",
    ".jpg",
    ".png",
    ".tif",
    ".tiff",
    ".webp",
}
IMAGE_MAGIC_READ_SIZE = 32
PDF_SIGNATURE = b"%PDF-"
ZIP_SIGNATURES = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")
HEIF_BRANDS = {
    b"heic",
    b"heix",
    b"hevc",
    b"hevx",
    b"mif1",
    b"msf1",
}


def _restore_position(upload: UploadFile, position: int) -> None:
    upload.file.seek(position)


def read_upload_header(upload: UploadFile, size: int = IMAGE_MAGIC_READ_SIZE) -> bytes:
    original_position = upload.file.tell()
    try:
        upload.file.seek(0)
        return upload.file.read(size)
    finally:
        _restore_position(upload, original_position)


def get_upload_size(upload: UploadFile) -> int:
    original_position = upload.file.tell()
    try:
        upload.file.seek(0, 2)
        return int(upload.file.tell())
    finally:
        _restore_position(upload, original_position)


def ensure_upload_within_size_limit(upload: UploadFile, *, max_size_bytes: int, label: str) -> int:
    upload_size = get_upload_size(upload)
    if upload_size > max_size_bytes:
        max_size_mb = round(max_size_bytes / (1024 * 1024), 1)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{label} exceeds the maximum allowed size of {max_size_mb} MB",
        )
    return upload_size


def is_supported_image_header(header: bytes) -> bool:
    if header.startswith(b"\xff\xd8\xff"):
        return True
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if header.startswith((b"GIF87a", b"GIF89a")):
        return True
    if header.startswith(b"BM"):
        return True
    if header.startswith((b"II*\x00", b"MM\x00*")):
        return True
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return True
    if len(header) >= 12 and header[4:8] == b"ftyp" and header[8:12] in HEIF_BRANDS:
        return True
    return False


def detect_document_source_type(upload: UploadFile) -> str:
    content_type = (upload.content_type or "").lower().strip()
    suffix = Path(upload.filename or "").suffix.lower()
    header = read_upload_header(upload)

    if content_type == "application/pdf" or suffix == ".pdf":
        if not header.startswith(PDF_SIGNATURE):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is not a valid PDF document",
            )
        return "pdf"

    if content_type.startswith("image/") or suffix in IMAGE_SUFFIXES:
        if not is_supported_image_header(header):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is not a supported image document",
            )
        return "image"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Only PDF files and images are supported",
    )


def validate_document_upload(upload: UploadFile) -> str:
    ensure_upload_within_size_limit(
        upload,
        max_size_bytes=settings.max_document_upload_size_bytes,
        label="Document upload",
    )
    return detect_document_source_type(upload)


def validate_historical_import_upload(upload: UploadFile) -> None:
    ensure_upload_within_size_limit(
        upload,
        max_size_bytes=settings.max_import_upload_size_bytes,
        label="Historical import file",
    )

    filename = (upload.filename or "").strip().lower()
    if not filename.endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поддерживается только .xlsx выгрузка исторических ремонтов",
        )

    header = read_upload_header(upload)
    if not header.startswith(ZIP_SIGNATURES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл исторического импорта не похож на корректный .xlsx документ",
        )
