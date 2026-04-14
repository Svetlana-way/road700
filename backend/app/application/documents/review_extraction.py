from __future__ import annotations

import re
from typing import Optional

from app.application.documents.text_fragments import extract_fragment_after_marker
from app.application.documents.config import REASON_SECTION_PATTERNS
from app.application.documents.text_utils import normalize_multiline_text


def extract_reason_from_text(text: str) -> Optional[str]:
    for pattern in REASON_SECTION_PATTERNS:
        match = pattern.search(text)
        if match is None:
            continue
        value = normalize_multiline_text(match.group("value")).strip(' "')
        if value:
            return value[:2000]
    return None


def extract_recommendations_from_text(text: str) -> Optional[str]:
    fragment = extract_fragment_after_marker(
        text,
        r"Рекомендации\s*:",
        stop_patterns=(
            r"НЕ\s+ДЕЛАЕМ\s*:",
            r"После\s+подписания",
            r"Сервисные\s+услуги\s+сдал",
            r"С\s+условиями\s+Программы",
        ),
        max_chars=2000,
    )
    if not fragment:
        return None

    lines = [normalize_multiline_text(line) for line in fragment.splitlines()]
    cleaned_lines = [line.strip(" -*") for line in lines if line.strip(" -*")]
    if not cleaned_lines:
        return None
    return " ".join(cleaned_lines)[:2000]


def extract_not_done_items_from_text(text: str) -> list[str]:
    fragment = extract_fragment_after_marker(
        text,
        r"НЕ\s+ДЕЛАЕМ\s*:",
        stop_patterns=(
            r"После\s+подписания",
            r"Сервисные\s+услуги\s+сдал",
            r"Страница\s+\d+\s+из\s+\d+",
        ),
        max_chars=2000,
    )
    if not fragment:
        return []

    items: list[str] = []
    for raw_line in fragment.splitlines():
        line = normalize_multiline_text(raw_line).strip()
        if not line:
            continue
        line = re.sub(r"^\d+[.)]\s*", "", line).strip()
        if not line:
            continue
        items.append(line[:300])
    return items[:6]
