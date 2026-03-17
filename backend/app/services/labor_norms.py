from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import CatalogStatus, VehicleType
from app.models.labor_norm_catalog import LaborNormCatalog
from app.models.labor_norm import LaborNorm


UNSET = object()


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
DEFAULT_DONGFENG_LABOR_NORM_SCOPE = "dongfeng_2025"
DEFAULT_DONGFENG_BRAND_FAMILY = "dongfeng"
DEFAULT_DONGFENG_CATALOG_NAME = "Dong Feng 2025"
VEHICLE_TEXT_REPLACEMENTS = str.maketrans(
    {
        "ё": "е",
        "Ё": "Е",
        "—": "-",
        "–": "-",
        "−": "-",
        "‑": "-",
        "/": " ",
        "\\": " ",
    }
)


def normalize_vehicle_match_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    normalized_value = str(value).strip().translate(VEHICLE_TEXT_REPLACEMENTS).lower()
    normalized_value = re.sub(r"\s+", " ", normalized_value)
    return normalized_value


def normalize_labor_norm_scope(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized_value = normalize_vehicle_match_text(value)
    normalized_value = re.sub(r"[^a-zа-я0-9]+", "_", normalized_value)
    normalized_value = normalized_value.strip("_")
    return normalized_value or None


def normalize_brand_family(value: Optional[str]) -> Optional[str]:
    normalized_value = normalize_labor_norm_scope(value)
    if normalized_value is None:
        return None
    return normalized_value.replace("_", "-")


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


@dataclass(frozen=True)
class LaborNormApplicability:
    eligible: bool
    scope: Optional[str]
    reason_code: str
    reason: str
    brand_family: Optional[str] = None
    catalog_name: Optional[str] = None


@dataclass(frozen=True)
class LaborNormEnrichmentSummary:
    matched_count: int = 0
    unmatched_count: int = 0


@dataclass(frozen=True)
class LaborNormCatalogMatch:
    catalog: LaborNormCatalog
    matched_rules: int
    score: int


def normalize_keyword_list(values: Optional[list[str]]) -> list[str]:
    normalized_values: list[str] = []
    for value in values or []:
        normalized_value = normalize_vehicle_match_text(value)
        if normalized_value:
            normalized_values.append(normalized_value)
    return list(dict.fromkeys(normalized_values))


def normalize_vin_prefixes(values: Optional[list[str]]) -> list[str]:
    prefixes: list[str] = []
    for value in values or []:
        normalized_value = re.sub(r"[^A-Z0-9]+", "", str(value).strip().upper())
        if normalized_value:
            prefixes.append(normalized_value)
    return list(dict.fromkeys(prefixes))


def sync_labor_norm_catalog_metadata(db: Session, catalog: LaborNormCatalog) -> None:
    norms = db.scalars(select(LaborNorm).where(LaborNorm.scope == catalog.scope)).all()
    for norm in norms:
        norm.brand_family = catalog.brand_family
        norm.catalog_name = catalog.catalog_name


def upsert_labor_norm_catalog(
    db: Session,
    *,
    scope: str,
    catalog_name: object = UNSET,
    brand_family: object = UNSET,
    vehicle_type: object = UNSET,
    year_from: object = UNSET,
    year_to: object = UNSET,
    brand_keywords: object = UNSET,
    model_keywords: object = UNSET,
    vin_prefixes: object = UNSET,
    priority: object = UNSET,
    auto_match_enabled: object = UNSET,
    status: object = UNSET,
    notes: object = UNSET,
) -> LaborNormCatalog:
    normalized_scope = normalize_labor_norm_scope(scope)
    if not normalized_scope:
        raise ValueError("Labor norm scope is required")

    existing = db.scalar(select(LaborNormCatalog).where(LaborNormCatalog.scope == normalized_scope))
    resolved_year_from = year_from if year_from is not UNSET else existing.year_from if existing is not None else None
    resolved_year_to = year_to if year_to is not UNSET else existing.year_to if existing is not None else None
    if resolved_year_from is not None and resolved_year_to is not None and resolved_year_from > resolved_year_to:
        raise ValueError("Catalog year_from cannot be greater than year_to")

    catalog = existing or LaborNormCatalog(scope=normalized_scope, catalog_name=normalized_scope)
    catalog.scope = normalized_scope
    if catalog_name is not UNSET:
        catalog.catalog_name = (
            str(catalog_name).strip()
            if isinstance(catalog_name, str) and str(catalog_name).strip()
            else existing.catalog_name if existing is not None
            else normalized_scope
        )
    elif existing is None:
        catalog.catalog_name = normalized_scope

    if brand_family is not UNSET:
        catalog.brand_family = normalize_brand_family(brand_family if isinstance(brand_family, str) else None)
    elif existing is None:
        catalog.brand_family = None

    if vehicle_type is not UNSET:
        catalog.vehicle_type = vehicle_type if isinstance(vehicle_type, VehicleType) or vehicle_type is None else None
    elif existing is None:
        catalog.vehicle_type = None

    if year_from is not UNSET:
        catalog.year_from = resolved_year_from if isinstance(resolved_year_from, int) or resolved_year_from is None else None
    elif existing is None:
        catalog.year_from = None

    if year_to is not UNSET:
        catalog.year_to = resolved_year_to if isinstance(resolved_year_to, int) or resolved_year_to is None else None
    elif existing is None:
        catalog.year_to = None

    if brand_keywords is not UNSET:
        catalog.brand_keywords = normalize_keyword_list(brand_keywords if isinstance(brand_keywords, list) else None)
    elif existing is None:
        catalog.brand_keywords = []

    if model_keywords is not UNSET:
        catalog.model_keywords = normalize_keyword_list(model_keywords if isinstance(model_keywords, list) else None)
    elif existing is None:
        catalog.model_keywords = []

    if vin_prefixes is not UNSET:
        catalog.vin_prefixes = normalize_vin_prefixes(vin_prefixes if isinstance(vin_prefixes, list) else None)
    elif existing is None:
        catalog.vin_prefixes = []

    if priority is not UNSET:
        catalog.priority = int(priority)
    elif existing is None:
        catalog.priority = 100

    if auto_match_enabled is not UNSET:
        catalog.auto_match_enabled = bool(auto_match_enabled)
    elif existing is None:
        catalog.auto_match_enabled = True

    if status is not UNSET:
        catalog.status = status if isinstance(status, CatalogStatus) else CatalogStatus.CONFIRMED
    elif existing is None:
        catalog.status = CatalogStatus.CONFIRMED

    if notes is not UNSET:
        catalog.notes = notes.strip() if isinstance(notes, str) and notes.strip() else None
    elif existing is None:
        catalog.notes = None

    db.add(catalog)
    db.flush()
    sync_labor_norm_catalog_metadata(db, catalog)
    return catalog


def load_labor_norm_catalogs(
    db: Session,
    *,
    include_archived: bool = False,
    auto_match_only: bool = False,
) -> list[LaborNormCatalog]:
    stmt = select(LaborNormCatalog).order_by(
        LaborNormCatalog.priority.asc(),
        LaborNormCatalog.catalog_name.asc(),
        LaborNormCatalog.scope.asc(),
    )
    if not include_archived:
        stmt = stmt.where(LaborNormCatalog.status != CatalogStatus.ARCHIVED)
    if auto_match_only:
        stmt = stmt.where(LaborNormCatalog.auto_match_enabled.is_(True))
    return db.scalars(stmt).all()


def catalog_matches_vehicle(catalog: LaborNormCatalog, vehicle: object) -> Optional[LaborNormCatalogMatch]:
    if catalog.status == CatalogStatus.ARCHIVED or not catalog.auto_match_enabled:
        return None

    vehicle_type = getattr(vehicle, "vehicle_type", None)
    if catalog.vehicle_type is not None and vehicle_type != catalog.vehicle_type:
        return None

    brand_text = normalize_vehicle_match_text(getattr(vehicle, "brand", None))
    model_text = normalize_vehicle_match_text(getattr(vehicle, "model", None))
    search_texts = [brand_text, model_text, f"{brand_text} {model_text}".strip()]
    vin = re.sub(r"[^A-Z0-9]+", "", str(getattr(vehicle, "vin", None) or "").strip().upper())
    year = getattr(vehicle, "year", None)

    matched_rules = 0
    score = 0

    brand_keywords = normalize_keyword_list(catalog.brand_keywords)
    if brand_keywords:
        if not any(keyword in text for keyword in brand_keywords for text in search_texts if text):
            return None
        matched_rules += 1
        score += 4

    model_keywords = normalize_keyword_list(catalog.model_keywords)
    if model_keywords:
        if not any(keyword in model_text for keyword in model_keywords):
            return None
        matched_rules += 1
        score += 3

    vin_prefixes = normalize_vin_prefixes(catalog.vin_prefixes)
    if vin_prefixes:
        if not any(vin.startswith(prefix) for prefix in vin_prefixes):
            return None
        matched_rules += 1
        score += 5

    if catalog.year_from is not None or catalog.year_to is not None:
        if year is None:
            return None
        if catalog.year_from is not None and year < catalog.year_from:
            return None
        if catalog.year_to is not None and year > catalog.year_to:
            return None
        matched_rules += 1
        score += 2

    if catalog.vehicle_type is not None:
        score += 1

    return LaborNormCatalogMatch(catalog=catalog, matched_rules=matched_rules, score=score)


def assess_labor_norm_applicability(db: Session, vehicle: object | None) -> LaborNormApplicability:
    if vehicle is None:
        return LaborNormApplicability(
            eligible=False,
            scope=None,
            reason_code="vehicle_missing",
            reason="Карточка техники не привязана к ремонту, применимость норм определить нельзя",
        )

    catalogs = load_labor_norm_catalogs(db, auto_match_only=True)
    if not catalogs:
        return LaborNormApplicability(
            eligible=False,
            scope=None,
            reason_code="catalogs_not_configured",
            reason="Автоматические каталоги нормо-часов ещё не настроены в админке",
        )

    matches = [match for catalog in catalogs if (match := catalog_matches_vehicle(catalog, vehicle)) is not None]
    if not matches:
        return LaborNormApplicability(
            eligible=False,
            scope=None,
            reason_code="catalog_not_found",
            reason="Для техники не найден подходящий каталог нормо-часов по текущим правилам",
        )

    matches.sort(
        key=lambda item: (
            item.matched_rules,
            item.score,
            -item.catalog.priority,
            item.catalog.catalog_name,
            item.catalog.scope,
        ),
        reverse=True,
    )
    best = matches[0]
    runner_up = matches[1] if len(matches) > 1 else None
    if (
        runner_up is not None
        and runner_up.matched_rules == best.matched_rules
        and runner_up.score == best.score
        and runner_up.catalog.priority == best.catalog.priority
    ):
        return LaborNormApplicability(
            eligible=False,
            scope=None,
            reason_code="catalog_ambiguous",
            reason="Для техники найдено несколько одинаково подходящих каталогов, требуется настройка приоритетов",
        )

    return LaborNormApplicability(
        eligible=True,
        scope=best.catalog.scope,
        reason_code="supported",
        reason=f"Автоматически выбран каталог {best.catalog.catalog_name}",
        brand_family=best.catalog.brand_family,
        catalog_name=best.catalog.catalog_name,
    )


def load_active_labor_norms(db: Session, *, scope: Optional[str] = None) -> list[LaborNorm]:
    stmt = (
        select(LaborNorm)
        .where(LaborNorm.status != CatalogStatus.ARCHIVED)
        .order_by(LaborNorm.scope.asc(), LaborNorm.code.asc())
    )
    normalized_scope = normalize_labor_norm_scope(scope)
    if normalized_scope:
        stmt = stmt.where(LaborNorm.scope == normalized_scope)
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
    scope: Optional[str] = None,
) -> Optional[LaborNormMatch]:
    normalized_scope = normalize_labor_norm_scope(scope)
    candidates = []
    for norm in load_active_labor_norms(db, scope=normalized_scope):
        scored = score_labor_norm_match(work_code=work_code, work_name=work_name, norm=norm)
        if scored is not None:
            candidates.append(scored)

    if not candidates:
        return None

    candidates.sort(key=lambda item: (item.score, item.norm.standard_hours, item.norm.code), reverse=True)
    best = candidates[0]
    runner_up = candidates[1] if len(candidates) > 1 else None

    if (
        normalized_scope is None
        and best.matched_by == "code"
        and runner_up is not None
        and runner_up.matched_by == "code"
        and runner_up.norm.code == best.norm.code
        and runner_up.norm.scope != best.norm.scope
    ):
        return None

    if (
        best.matched_by != "code"
        and runner_up is not None
        and abs(best.score - runner_up.score) < 0.0001
        and best.norm.scope == runner_up.norm.scope
        and best.norm.name_ru == runner_up.norm.name_ru
    ):
        return None

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
