from __future__ import annotations

import re
from typing import Optional

from app.application.documents.field_extractors import first_match
from app.application.documents.text_utils import normalize_text, parse_amount, parse_date_value
from app.models.ocr_rule import OcrRule


def match_custom_ocr_rule(
    text: str,
    rules: list[OcrRule],
) -> tuple[Optional[str], Optional[float], Optional[OcrRule]]:
    for rule in rules:
        try:
            match = re.search(rule.pattern, text, re.IGNORECASE | re.MULTILINE)
        except re.error:
            continue
        if not match:
            continue
        captured = match.group(1) if match.groups() else match.group(0)
        return normalize_text(captured), float(rule.confidence), rule
    return None, None, None


def parse_ocr_rule_value(raw_value: str, value_parser: str) -> Optional[object]:
    if value_parser == "date":
        parsed_date = parse_date_value(raw_value)
        return parsed_date.isoformat() if parsed_date else None
    if value_parser == "amount":
        return parse_amount(raw_value)
    if value_parser == "digits_int":
        digits_only = re.sub(r"\D", "", raw_value)
        return int(digits_only) if digits_only else None
    return raw_value


def extract_header_field(
    text: str,
    *,
    target_field: str,
    fallback_patterns: list[str],
    fallback_parser: str,
    fallback_confidence: float,
    rule_map: dict[str, list[OcrRule]],
) -> tuple[Optional[object], Optional[float], bool]:
    rules = rule_map.get(target_field, [])
    custom_match, custom_confidence, matched_rule = match_custom_ocr_rule(text, rules)
    if custom_match is not None:
        parser_name = matched_rule.value_parser if matched_rule is not None else fallback_parser
        parsed_value = parse_ocr_rule_value(custom_match, parser_name)
        if parsed_value is not None:
            return parsed_value, custom_confidence, False
        return None, None, True

    fallback_match = first_match(fallback_patterns, text)
    if fallback_match is None:
        return None, None, False
    parsed_value = parse_ocr_rule_value(fallback_match, fallback_parser)
    if parsed_value is None:
        return None, None, True
    return parsed_value, fallback_confidence, False
