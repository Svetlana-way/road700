from __future__ import annotations

from app.application.documents.text_utils import (
    clean_text_lines,
    generate_text_variants,
    normalize_multiline_text,
    normalize_text,
    score_tesseract_ocr_variant,
    score_text_quality,
    select_best_tesseract_ocr_variant,
    select_best_text_variant,
)
from typing import Optional

from app.application.documents.review_extraction import (
    extract_not_done_items_from_text,
    extract_reason_from_text,
    extract_recommendations_from_text,
)

try:
    from PIL import Image, ImageChops
except ImportError:  # pragma: no cover - optional dependency during bootstrap
    Image = None
    ImageChops = None

def is_pillow_available() -> bool:
    return Image is not None and ImageChops is not None
