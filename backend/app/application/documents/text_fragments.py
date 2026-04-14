from __future__ import annotations

import re
from typing import Optional

from app.application.documents.text_utils import parse_amount


def extract_fragment_after_marker(
    text: str,
    marker_pattern: str,
    *,
    stop_patterns: tuple[str, ...] = (),
    max_chars: int = 2500,
) -> Optional[str]:
    marker_match = re.search(marker_pattern, text, re.IGNORECASE | re.MULTILINE)
    if marker_match is None:
        return None

    fragment = text[marker_match.end(): marker_match.end() + max_chars]
    stop_offsets = []
    for pattern in stop_patterns:
        stop_match = re.search(pattern, fragment, re.IGNORECASE | re.MULTILINE)
        if stop_match is not None:
            stop_offsets.append(stop_match.start())
    if stop_offsets:
        fragment = fragment[: min(stop_offsets)]
    return fragment


def extract_largest_amount_around_marker(
    text: str,
    marker_pattern: str,
    *,
    before_chars: int = 0,
    after_chars: int = 2500,
    stop_patterns: tuple[str, ...] = (),
) -> Optional[float]:
    marker_match = re.search(marker_pattern, text, re.IGNORECASE | re.MULTILINE)
    if marker_match is None:
        return None

    prefix = text[max(0, marker_match.start() - before_chars): marker_match.start()]
    suffix = text[marker_match.end(): marker_match.end() + after_chars]
    stop_offsets = []
    for pattern in stop_patterns:
        stop_match = re.search(pattern, suffix, re.IGNORECASE | re.MULTILINE)
        if stop_match is not None:
            stop_offsets.append(stop_match.start())
    if stop_offsets:
        suffix = suffix[: min(stop_offsets)]

    fragment = f"{prefix}\n{suffix}".strip()
    return extract_largest_amount_from_fragment(fragment)


def extract_largest_amount_from_fragment(fragment: str | None) -> Optional[float]:
    if not fragment:
        return None
    candidates = [
        parse_amount(match.group(0))
        for match in re.finditer(r"\d[\d\s']*(?:[.,-]\d{2})", fragment)
    ]
    normalized_candidates = [value for value in candidates if value is not None and value > 0]
    if not normalized_candidates:
        return None
    return max(normalized_candidates)


def extract_amount_candidates_from_fragment(fragment: str | None) -> list[float]:
    if not fragment:
        return []
    values = [
        parse_amount(match.group(0))
        for match in re.finditer(r"\d[\d\s']*(?:[.,-]\d{2})", fragment)
    ]
    return [value for value in values if value is not None and value > 0]
