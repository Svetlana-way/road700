from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.enums import DocumentStatus
from app.models.ocr_profile_matcher import OcrProfileMatcher
from app.models.ocr_rule import OcrRule
from app.application.documents.config import (
    DEFAULT_OCR_PROFILE_MATCHER_DEFINITIONS,
    DEFAULT_OCR_RULE_DEFINITIONS,
)


@dataclass(frozen=True)
class OcrProfileSelection:
    profile_scope: str
    source: str
    reason: str


def _normalize_inline_text(value: str) -> str:
    return re.sub(r"[ \t]+", " ", value).strip()


def normalize_ocr_rule_code(value: str | None) -> Optional[str]:
    if value is None:
        return None
    normalized = _normalize_inline_text(str(value)).lower()
    normalized = re.sub(r"[^a-z0-9_:-]+", "_", normalized)
    normalized = normalized.strip("_")
    return normalized or None


def ensure_default_ocr_rules(db: Session) -> None:
    existing_signatures = {
        (
            str(rule.profile_scope),
            str(rule.target_field),
            str(rule.pattern),
        )
        for rule in db.scalars(select(OcrRule)).all()
    }
    for item in DEFAULT_OCR_RULE_DEFINITIONS:
        signature = (
            str(item["profile_scope"]),
            str(item["target_field"]),
            str(item["pattern"]),
        )
        if signature in existing_signatures:
            continue
        db.add(
            OcrRule(
                profile_scope=str(item["profile_scope"]),
                target_field=str(item["target_field"]),
                pattern=str(item["pattern"]),
                value_parser=str(item["value_parser"]),
                confidence=float(item["confidence"]),
                priority=int(item["priority"]),
                is_active=True,
            )
        )
        existing_signatures.add(signature)
    db.flush()


def ensure_default_ocr_profile_matchers(db: Session) -> None:
    existing_count = db.scalar(select(func.count(OcrProfileMatcher.id))) or 0
    if existing_count > 0:
        return
    for item in DEFAULT_OCR_PROFILE_MATCHER_DEFINITIONS:
        db.add(
            OcrProfileMatcher(
                profile_scope=str(item["profile_scope"]),
                title=str(item["title"]),
                source_type=str(item["source_type"]) if item.get("source_type") else None,
                filename_pattern=str(item["filename_pattern"]) if item.get("filename_pattern") else None,
                text_pattern=str(item["text_pattern"]) if item.get("text_pattern") else None,
                service_name_pattern=str(item["service_name_pattern"]) if item.get("service_name_pattern") else None,
                priority=int(item["priority"]),
                is_active=True,
            )
        )
    db.flush()


def load_active_ocr_rules(db: Session, *, profile_scope: str | None = None) -> list[OcrRule]:
    ensure_default_ocr_rules(db)
    stmt = (
        select(OcrRule)
        .where(OcrRule.is_active.is_(True))
        .order_by(OcrRule.profile_scope.asc(), OcrRule.target_field.asc(), OcrRule.priority.asc(), OcrRule.id.asc())
    )
    normalized_profile_scope = normalize_ocr_rule_code(profile_scope) if profile_scope else None
    if normalized_profile_scope:
        stmt = stmt.where(OcrRule.profile_scope.in_(("default", normalized_profile_scope)))
    return db.scalars(stmt).all()


def load_active_ocr_profile_matchers(db: Session) -> list[OcrProfileMatcher]:
    ensure_default_ocr_profile_matchers(db)
    stmt = (
        select(OcrProfileMatcher)
        .where(OcrProfileMatcher.is_active.is_(True))
        .order_by(OcrProfileMatcher.priority.asc(), OcrProfileMatcher.id.asc())
    )
    return db.scalars(stmt).all()


def infer_builtin_profile_scope_from_text(text: str, *, source_type: str = "pdf") -> Optional[str]:
    matched: list[dict[str, object]] = []
    for item in DEFAULT_OCR_PROFILE_MATCHER_DEFINITIONS:
        matcher_source_type = str(item.get("source_type") or "")
        if matcher_source_type and matcher_source_type != source_type:
            continue
        text_pattern = str(item.get("text_pattern") or "")
        if not text_pattern:
            continue
        try:
            if re.search(text_pattern, text, re.IGNORECASE | re.MULTILINE | re.DOTALL) is None:
                continue
        except re.error:
            continue
        matched.append(item)

    if not matched:
        return None

    matched.sort(key=lambda item: int(item["priority"]))
    best = matched[0]
    runner_up = matched[1] if len(matched) > 1 else None
    if runner_up is not None and int(runner_up["priority"]) == int(best["priority"]) and runner_up["profile_scope"] != best["profile_scope"]:
        return None
    return str(best["profile_scope"])


def extract_profile_history_scope(document: Document) -> Optional[str]:
    repair = document.repair
    if repair is None:
        return None
    candidate_versions = []
    for sibling in repair.documents:
        if sibling.id == document.id or sibling.status == DocumentStatus.ARCHIVED:
            continue
        for version in sibling.versions:
            payload = version.parsed_payload if isinstance(version.parsed_payload, dict) else {}
            profile_scope = payload.get("ocr_profile_scope")
            if isinstance(profile_scope, str) and profile_scope.strip():
                candidate_versions.append((version.created_at, profile_scope.strip()))
    if not candidate_versions:
        return None
    candidate_versions.sort(key=lambda item: item[0], reverse=True)
    return candidate_versions[0][1]


def profile_matcher_applies(
    matcher: OcrProfileMatcher,
    *,
    document: Document,
    text: str,
) -> bool:
    if matcher.source_type and matcher.source_type != document.source_type:
        return False

    filename = document.original_filename or ""
    if matcher.filename_pattern:
        try:
            if re.search(matcher.filename_pattern, filename, re.IGNORECASE | re.MULTILINE) is None:
                return False
        except re.error:
            return False

    if matcher.text_pattern:
        try:
            if re.search(matcher.text_pattern, text, re.IGNORECASE | re.MULTILINE | re.DOTALL) is None:
                return False
        except re.error:
            return False

    if matcher.service_name_pattern:
        service_name = document.repair.service.name if document.repair and document.repair.service else ""
        try:
            if re.search(matcher.service_name_pattern, service_name, re.IGNORECASE | re.MULTILINE | re.DOTALL) is None:
                return False
        except re.error:
            return False

    return True


def select_ocr_profile_scope(db: Session, document: Document, text: str) -> OcrProfileSelection:
    history_scope = extract_profile_history_scope(document)
    matchers = load_active_ocr_profile_matchers(db)
    matched = [item for item in matchers if profile_matcher_applies(item, document=document, text=text)]
    if matched:
        matched.sort(key=lambda item: (item.priority, item.id))
        best = matched[0]
        runner_up = matched[1] if len(matched) > 1 else None
        if (
            runner_up is not None
            and runner_up.priority == best.priority
            and runner_up.profile_scope != best.profile_scope
        ):
            if history_scope:
                return OcrProfileSelection(
                    profile_scope=history_scope,
                    source="history_fallback",
                    reason="Есть несколько одинаково подходящих matcher-правил, выбран последний профиль ремонта",
                )
            return OcrProfileSelection(
                profile_scope="default",
                source="ambiguous_fallback",
                reason="Есть несколько одинаково подходящих matcher-правил, выбран default-профиль",
            )
        return OcrProfileSelection(
            profile_scope=best.profile_scope,
            source="matcher",
            reason=best.title,
        )

    if history_scope:
        return OcrProfileSelection(
            profile_scope=history_scope,
            source="history",
            reason="Использован последний OCR-профиль из истории ремонта",
        )

    return OcrProfileSelection(
        profile_scope="default",
        source="default",
        reason="Подходящий профиль не найден, использован default",
    )


def build_ocr_rule_sort_key(rule: OcrRule, *, profile_scope: str | None = None) -> tuple[int, int, int, int]:
    normalized_profile_scope = normalize_ocr_rule_code(profile_scope)
    normalized_rule_scope = normalize_ocr_rule_code(rule.profile_scope)
    if normalized_profile_scope and normalized_rule_scope == normalized_profile_scope:
        scope_rank = 0
    elif normalized_rule_scope == "default":
        scope_rank = 1
    else:
        scope_rank = 2
    return (scope_rank, int(rule.priority), -len(str(rule.pattern or "")), int(rule.id or 0))


def group_ocr_rules_by_field(rules: list[OcrRule], *, profile_scope: str | None = None) -> dict[str, list[OcrRule]]:
    grouped: dict[str, list[OcrRule]] = {}
    for rule in rules:
        grouped.setdefault(rule.target_field, []).append(rule)
    for field_rules in grouped.values():
        field_rules.sort(key=lambda item: build_ocr_rule_sort_key(item, profile_scope=profile_scope))
    return grouped
