from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import CatalogStatus
from app.models.labor_norm import LaborNorm


MATCH_TEXT_REPLACEMENTS = str.maketrans(
    {
        "ё": "е",
        "Ё": "Е",
        "О": "O",
        "о": "o",
        "А": "A",
        "а": "a",
        "В": "B",
        "в": "b",
        "Е": "E",
        "е": "e",
        "К": "K",
        "к": "k",
        "М": "M",
        "м": "m",
        "Н": "H",
        "н": "h",
        "Р": "P",
        "р": "p",
        "С": "C",
        "с": "c",
        "Т": "T",
        "т": "t",
        "У": "Y",
        "у": "y",
        "Х": "X",
        "х": "x",
        "І": "I",
        "і": "i",
        "—": "-",
        "–": "-",
        "−": "-",
        "‑": "-",
        "/": " ",
        "\\": " ",
    }
)
MATCH_STOPWORDS = {
    "диагностика",
    "неисправностей",
    "неисправности",
    "замена",
    "узла",
    "сборе",
    "сборка",
    "левого",
    "правого",
    "левый",
    "правый",
    "переднего",
    "заднего",
    "передний",
    "задний",
    "верхний",
    "нижний",
    "основной",
    "вспомогательный",
    "детали",
    "деталь",
    "узел",
}


def normalize_labor_norm_code(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized_value = str(value).strip().translate(MATCH_TEXT_REPLACEMENTS).upper()
    normalized_value = re.sub(r"[^A-Z0-9/_-]+", "", normalized_value)
    return normalized_value or None


def tokenize_match_text(value: Optional[str]) -> list[str]:
    if not value:
        return []
    normalized_value = str(value).strip().translate(MATCH_TEXT_REPLACEMENTS).lower()
    normalized_value = re.sub(r"[^a-zа-я0-9]+", " ", normalized_value)
    tokens = []
    for token in normalized_value.split():
        if len(token) <= 1:
            continue
        if token in MATCH_STOPWORDS:
            continue
        tokens.append(token)
    return tokens


def build_normalized_name(*values: Optional[str]) -> str:
    tokens: list[str] = []
    for value in values:
        tokens.extend(tokenize_match_text(value))
    deduped = sorted(dict.fromkeys(tokens))
    return " ".join(deduped)


def build_search_text(*values: Optional[str]) -> str:
    parts = [str(value).strip() for value in values if value]
    return " | ".join(parts)


@dataclass
class LaborNormMatch:
    norm: LaborNorm
    score: float
    matched_by: str


def load_active_labor_norms(db: Session) -> list[LaborNorm]:
    stmt = (
        select(LaborNorm)
        .where(LaborNorm.status != CatalogStatus.ARCHIVED)
        .order_by(LaborNorm.code.asc())
    )
    return db.scalars(stmt).all()


def score_labor_norm_match(
    *,
    work_code: Optional[str],
    work_name: str,
    norm: LaborNorm,
) -> Optional[LaborNormMatch]:
    normalized_work_code = normalize_labor_norm_code(work_code)
    if normalized_work_code and normalized_work_code == norm.code:
        return LaborNormMatch(norm=norm, score=1.0, matched_by="code")

    work_tokens = set(tokenize_match_text(work_name))
    if not work_tokens:
        return None

    norm_tokens = set((norm.normalized_name or "").split())
    if not norm_tokens:
        norm_tokens = set(tokenize_match_text(norm.name_ru))
    intersections = work_tokens & norm_tokens
    if not intersections:
        return None

    coverage = len(intersections) / len(work_tokens)
    specificity = len(intersections) / len(norm_tokens)
    score = round(coverage * 0.75 + specificity * 0.25, 4)

    normalized_work_name = " ".join(sorted(work_tokens))
    matched_by = "name_tokens"
    if normalized_work_name and normalized_work_name == norm.normalized_name:
        score = max(score, 0.94)
        matched_by = "normalized_name"
    elif normalized_work_name and (
        normalized_work_name in norm.normalized_name or norm.normalized_name in normalized_work_name
    ):
        score = min(0.93, score + 0.08)
        matched_by = "name_contains"

    if score < 0.55:
        return None
    return LaborNormMatch(norm=norm, score=score, matched_by=matched_by)


def find_best_labor_norm_match(
    db: Session,
    *,
    work_code: Optional[str],
    work_name: str,
) -> Optional[LaborNormMatch]:
    candidates = []
    for norm in load_active_labor_norms(db):
        scored = score_labor_norm_match(work_code=work_code, work_name=work_name, norm=norm)
        if scored is not None:
            candidates.append(scored)

    if not candidates:
        return None

    candidates.sort(key=lambda item: (item.score, item.norm.standard_hours, item.norm.code), reverse=True)
    best = candidates[0]
    runner_up = candidates[1] if len(candidates) > 1 else None

    if best.matched_by == "code":
        return best
    if best.score >= 0.9:
        return best
    if runner_up is not None and best.score - runner_up.score < 0.12:
        return None
    if best.score < 0.68:
        return None
    return best


def default_labor_norms_path(project_root: Path) -> Path:
    return project_root / "Норма часов Донг Фенг 2025 год.xlsx"
