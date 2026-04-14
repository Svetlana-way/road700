from app.application.documents.runtime_text import (
    clean_text_lines,
    extract_not_done_items_from_text,
    extract_reason_from_text,
    extract_recommendations_from_text,
    generate_text_variants,
    is_pillow_available,
    normalize_multiline_text,
    normalize_text,
    score_tesseract_ocr_variant,
    score_text_quality,
    select_best_tesseract_ocr_variant,
    select_best_text_variant,
)
