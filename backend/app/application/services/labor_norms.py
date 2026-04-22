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
    "демонтаж",
    "монтаж",
    "снятие",
    "установка",
    "установки",
    "установить",
    "проверка",
    "регулировка",
    "датчик",
    "датчика",
    "дисковые",
    "дисковый",
    "дисковая",
    "одна",
    "ось",
    "сборе",
}


def _normalize_match_token(value: str) -> str:
    normalized_value = str(value).strip().translate(MATCH_TEXT_REPLACEMENTS).lower()
    normalized_value = re.sub(r"[^a-zа-я0-9]+", "", normalized_value)
    return normalized_value


NORMALIZED_MATCH_STOPWORDS = {
    normalized
    for normalized in (_normalize_match_token(value) for value in MATCH_STOPWORDS)
    if normalized
}
KNOWN_NON_CATALOG_SERVICE_KEYWORDS = (
    "мойка",
    "нормокомплект",
    "то прицепа",
    "то 1",
    "to 1",
    "сварочн",
    "параметры проверка",
    "подсоединение отсоединение диагностического прибора",
    "подсоединение-отсоединение диагностического прибора",
    "диагностического прибора",
    "схождение колес",
    "юстировка колес",
    "перекидка воздушная",
    "перекидка электрическая",
    "палм",
    "компьютерная диагностика",
    "диагностика abs прицепа",
    "диагностика полуприцепа tebs g2",
    "осмотр по бланку инспекции осмотра",
    "осмотр п п по бланку инспекции осмотра",
    "расходные материалы",
)
KNOWN_NON_CATALOG_HIGH_CONFIDENCE_CODES = {
    "0101",
    "17010-2",
    "137102-3",
    "32300",
    "60108-2",
    "60131-3",
    "700700",
    "150000",
    "250000",
}
KNOWN_NON_CATALOG_GENERIC_CODES = {
    "00",
    "01",
    "02",
    "100",
    "114",
    "37117-2",
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


def normalize_known_work_name(
    work_name: Optional[str],
    *,
    work_code: Optional[str] = None,
) -> str:
    raw_name = re.sub(r"\s+", " ", str(work_name or "").strip())
    if not raw_name:
        return ""

    normalized_name = normalize_vehicle_match_text(raw_name)
    normalized_name = re.sub(r"[^a-zа-я0-9]+", " ", normalized_name).strip()
    normalized_code = normalize_labor_norm_code(work_code)

    if "калибровка кпп" in normalized_name and "диагностического прибора" in normalized_name:
        return "Калибровка КПП и сцепления с использованием диагностического прибора"

    if normalized_code == "17010-2" and "диагностического прибора" in normalized_name:
        return "Подсоединение/отсоединение диагностического прибора"

    if normalized_code == "700700" and "прицеп" in normalized_name and (
        re.search(r"\bто\b", normalized_name) or "техническ" in normalized_name
    ):
        return "ТО прицепа"

    if normalized_code == "137102-3" and "провод" in normalized_name and (
        "разъем" in normalized_name or "разьем" in normalized_name
    ):
        return "Электрические провода и разъемы, проверка, очистка"

    if re.match(r"^(?:no|n0|nº|№)\s+", raw_name, re.IGNORECASE) and (
        re.search(r"\btebs\s*g2\b", normalized_name) and "диагност" in normalized_name
    ):
        return "Диагностика TEBS G2"

    if re.search(r"(?:поиск|рабок)\s+неисправност\w*\s+в\s+электрооборуд", normalized_name):
        return "Поиск неисправности в электрооборудовании"

    if re.search(r"(?:поиск|рабок)\s+неисправност\w*\s+в\s+пневмосистем", normalized_name):
        return "Поиск неисправности в пневмосистеме"

    if normalized_name.startswith("палм замена"):
        return "Палм замена"

    if "dongfeng" in normalized_name and ("нагностика" in normalized_name or "диагностика" in normalized_name):
        return "Диагностика с использованием ПС DongFeng"

    return raw_name


def tokenize_match_text(value: Optional[str]) -> list[str]:
    if not value:
        return []
    normalized_value = str(value).strip().translate(MATCH_TEXT_REPLACEMENTS).lower()
    normalized_value = re.sub(r"[^a-zа-я0-9]+", " ", normalized_value)
    tokens = []
    for token in normalized_value.split():
        if len(token) <= 1:
            continue
        if token in NORMALIZED_MATCH_STOPWORDS:
            continue
        tokens.append(token)
    return tokens


def extract_labor_norm_code_from_text(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    match = re.match(r"^\s*(?:код\s+)?([0-9]{8})(?=\D|$)", str(value), re.IGNORECASE)
    if not match:
        return None
    return normalize_labor_norm_code(match.group(1))


def work_name_conflicts_with_norm_name(work_name: Optional[str], norm_name: Optional[str]) -> bool:
    work_tokens = set(tokenize_match_text(work_name))
    if len(work_tokens) < 2:
        return False
    norm_tokens = set(tokenize_match_text(norm_name))
    if not norm_tokens:
        return False
    return not bool(work_tokens & norm_tokens)


def work_name_conflicts_with_norm(work_name: Optional[str], norm: LaborNorm) -> bool:
    variant_names = iter_labor_norm_match_variants(norm)
    if not variant_names:
        return work_name_conflicts_with_norm_name(work_name, norm.name_ru)
    return all(work_name_conflicts_with_norm_name(work_name, variant_name) for variant_name in variant_names)


def build_normalized_name(*values: Optional[str]) -> str:
    tokens: list[str] = []
    for value in values:
        tokens.extend(tokenize_match_text(value))
    deduped = sorted(dict.fromkeys(tokens))
    return " ".join(deduped)


def build_search_text(*values: Optional[str]) -> str:
    parts = [str(value).strip() for value in values if value]
    return " | ".join(parts)


def iter_labor_norm_match_variants(norm: LaborNorm) -> list[str]:
    variants: list[str] = []

    def add_variant(value: Optional[str]) -> None:
        normalized = build_normalized_name(value)
        if normalized and normalized not in variants:
            variants.append(normalized)

    add_variant(norm.name_ru)
    for raw_alias in (norm.name_ru_alt or "").split(";"):
        add_variant(raw_alias)
    add_variant(norm.name_en)
    add_variant(norm.normalized_name)
    return variants


def classify_known_non_catalog_operation(
    *,
    work_code: Optional[str],
    work_name: Optional[str],
) -> tuple[bool, Optional[str]]:
    normalized_name = normalize_vehicle_match_text(normalize_known_work_name(work_name, work_code=work_code))
    normalized_name = re.sub(r"[^a-zа-я0-9]+", " ", normalized_name).strip()
    normalized_code = normalize_labor_norm_code(work_code)
    keyword_match = any(keyword in normalized_name for keyword in KNOWN_NON_CATALOG_SERVICE_KEYWORDS)

    if normalized_code in KNOWN_NON_CATALOG_HIGH_CONFIDENCE_CODES:
        return True, "Операция использует локальный сервисный код и не относится к каталогу нормо-часов производителя"

    if keyword_match and normalized_code in KNOWN_NON_CATALOG_GENERIC_CODES:
        return True, "Операция использует локальный сервисный код и не относится к каталогу нормо-часов производителя"

    if keyword_match:
        return True, "Операция похожа на локальную сервисную услугу вне каталога нормо-часов производителя"

    return False, None


def infer_labor_norm_catalog_gap_reason_code(work_name: Optional[str]) -> Optional[str]:
    raw_name = normalize_vehicle_match_text(work_name)
    if not raw_name:
        return None

    if re.search(r"\babs\b", raw_name) and "датчик" in raw_name:
        return "catalog_gap_missing_abs_position"

    if "тормозн" in raw_name and "шланг" in raw_name:
        return "catalog_gap_missing_brake_hose_context"

    if "запасное колесо" in raw_name:
        return "catalog_gap_no_spare_wheel_norm"

    if "амортизатор" in raw_name and ("болт" in raw_name or "креплен" in raw_name):
        return "catalog_gap_missing_shock_absorber_position"

    if (
        "электропровод" in raw_name
        or ("провода" in raw_name and "разъем" in raw_name)
        or ("провода" in raw_name and "разьем" in raw_name)
        or (("разъем" in raw_name or "разьем" in raw_name) and "кабел" in raw_name)
    ):
        return "catalog_gap_missing_wiring_context"

    return None


def infer_labor_norm_catalog_gap_reason(work_name: Optional[str]) -> Optional[str]:
    reason_code = infer_labor_norm_catalog_gap_reason_code(work_name)
    if reason_code == "catalog_gap_missing_abs_position":
        return "работа выглядит осмысленной, но для датчика ABS не указана ось или сторона, поэтому выбрать норму из каталога нельзя"
    if reason_code == "catalog_gap_missing_brake_hose_context":
        return "работа выглядит осмысленной, но для тормозного шланга не указан контур, ось или тип магистрали"
    if reason_code == "catalog_gap_no_spare_wheel_norm":
        return "работа выглядит осмысленной, но в каталоге не найден отдельный норматив на снятие запасного колеса"
    if reason_code == "catalog_gap_missing_shock_absorber_position":
        return "работа выглядит осмысленной, но указан только крепеж амортизатора без оси или позиции узла"
    if reason_code == "catalog_gap_missing_wiring_context":
        return "работа выглядит осмысленной, но описана слишком общо: в каталоге есть только нормы для конкретных жгутов, разъемов и зон автомобиля"
    return None


def build_labor_norm_resolution_hint(
    *,
    work_name: str,
    reference_status: Optional[str],
) -> Optional[str]:
    if reference_status == "ocr_noise":
        return "Проверить исходный скан или OCR-слой: строка не подходит для автоматической сверки."

    if reference_status == "outside_catalog_service":
        return "Оставлять вне каталога нормо-часов и показывать как локальную сервисную операцию."

    if reference_status != "catalog_gap":
        return None

    reason_code = infer_labor_norm_catalog_gap_reason_code(work_name)
    if reason_code == "catalog_gap_missing_abs_position":
        return "Чтобы подобрать норму, в заказ-наряде нужно указать ось или сторону датчика ABS."
    if reason_code == "catalog_gap_missing_brake_hose_context":
        return "Чтобы подобрать норму, нужно указать контур, ось или тип тормозной магистрали."
    if reason_code == "catalog_gap_no_spare_wheel_norm":
        return "Оставить ручную проверку: отдельной нормы на снятие запасного колеса в каталоге не найдено."
    if reason_code == "catalog_gap_missing_shock_absorber_position":
        return "Для подбора нормы нужно указать ось и точку крепления амортизатора."
    if reason_code == "catalog_gap_missing_wiring_context":
        return "Для подбора нормы нужно указать конкретный жгут, разъем и зону автомобиля."
    return "Нужна ручная проверка. Если формулировка повторяется, решать через alias или отдельное правило классификации."


def build_labor_norm_rewrite_draft(
    *,
    work_name: str,
    reference_status: Optional[str],
    document_text: Optional[str] = None,
) -> Optional[str]:
    if reference_status != "catalog_gap":
        return None

    raw_work_name = str(work_name or "").strip()
    normalized_document_text = re.sub(r"\s+", " ", document_text or "").strip().lower()

    if raw_work_name in {"Ремонт электропроводки", "Разьем, замена (1-8 кабелей)"} and (
        "заднего фонаря" in normalized_document_text or "разъема" in normalized_document_text
    ):
        return (
            "Черновик для ручной проверки: `Электропроводка заднего фонаря, ремонт/замена разъема`. "
            "Перед подбором нормы подтвердить по первичке, что это одна работа, а не несколько отдельных операций."
        )

    if raw_work_name == "Электропроводка" and (
        "правой стороны п/п" in normalized_document_text
        or "платы заднего фонаря" in normalized_document_text
        or "разъема фонаря" in normalized_document_text
        or "разъёма фонаря" in normalized_document_text
    ):
        return (
            "Черновик для ручной проверки: `Ремонт электропроводки правой стороны п/п, фонарь/разъем`. "
            "Если в документе одновременно есть проводка, плата фонаря и разъем, их нужно разделить на отдельные строки."
        )

    if raw_work_name in {"Датчик ABS, замена", "Диагностика/проверка датчика ABS"} and (
        "удлинителя датчика абс" in normalized_document_text or "удлинитель датчика абс" in normalized_document_text
    ):
        return (
            "Черновик для ручной проверки: `Провод/удлинитель датчика АБС, ремонт или замена, [ось/сторона]`. "
            "Не подставлять норму автоматически, пока не подтверждено, что менялся датчик, проводка или удлинитель."
        )

    if raw_work_name in {"Ремонт электропроводки", "Электропроводка"} and (
        "удлинителя датчика абс" in normalized_document_text or "удлинитель датчика абс" in normalized_document_text
    ):
        return (
            "Черновик для ручной проверки: `Проводка/удлинитель датчика АБС, ремонт или замена, [ось/сторона]`. "
            "Нужно подтвердить по первичке, что речь именно о проводке ABS, а не о другой электрической работе."
        )

    if raw_work_name == "Тормозной шланг, замена" and "левый тормозной шланг" in normalized_document_text:
        return (
            "Черновик для ручной проверки: `Левый тормозной шланг, замена, [контур/ось]`. "
            "Каталожный подбор возможен только после явного уточнения контура или оси."
        )

    if raw_work_name == "Запасное колесо, снятие" and "креплению запасного колеса" in normalized_document_text:
        return (
            "Не переписывать как снятие запасного колеса: по тексту больше похоже на "
            "`Слесарно-сварочные работы по креплению запасного колеса`, то есть ручную локальную работу."
        )

    reason_code = infer_labor_norm_catalog_gap_reason_code(raw_work_name)
    if reason_code == "catalog_gap_missing_abs_position":
        return "Черновик для ручной проверки: `Датчик ABS, замена/проверка, [ось/сторона]`."
    if reason_code == "catalog_gap_missing_brake_hose_context":
        return "Черновик для ручной проверки: `Тормозной шланг, замена, [контур/ось/сторона]`."
    if reason_code == "catalog_gap_missing_shock_absorber_position":
        return (
            "Черновик для ручной проверки: `Болт крепления амортизатора, установка/замена, [верх/низ], [ось/сторона]`. "
            "Без этих уточнений строку нельзя объективно связать с нормой производителя."
        )
    if reason_code == "catalog_gap_missing_wiring_context":
        return "Черновик невозможен без первички: нужно добавить конкретный жгут, разъем и зону автомобиля."

    return None


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
        .join(LaborNormCatalog, LaborNormCatalog.scope == LaborNorm.scope)
        .where(LaborNorm.status != CatalogStatus.ARCHIVED)
        .where(LaborNormCatalog.status != CatalogStatus.ARCHIVED)
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
        if work_name_conflicts_with_norm(work_name, norm):
            return None
        return LaborNormMatch(norm=norm, score=1.0, matched_by="code")

    embedded_work_code = extract_labor_norm_code_from_text(work_name)
    if embedded_work_code and embedded_work_code == norm.code:
        return LaborNormMatch(norm=norm, score=0.99, matched_by="embedded_code")

    work_tokens = set(tokenize_match_text(work_name))
    if not work_tokens:
        return None

    variant_names = iter_labor_norm_match_variants(norm)
    normalized_work_name = " ".join(sorted(work_tokens))
    if len(work_tokens) < 2 and normalized_work_name and not any(normalized_work_name == variant for variant in variant_names):
        return None

    variant_scores: list[tuple[float, set[str], str]] = []
    for variant_name in variant_names:
        variant_tokens = set(variant_name.split())
        if not variant_tokens:
            continue
        intersections = work_tokens & variant_tokens
        if not intersections:
            continue
        coverage = len(intersections) / len(work_tokens)
        specificity = len(intersections) / len(variant_tokens)
        variant_scores.append((round(coverage * 0.75 + specificity * 0.25, 4), variant_tokens, variant_name))

    if not variant_scores:
        return None

    score, norm_tokens, _best_variant_name = max(
        variant_scores,
        key=lambda item: (item[0], len(work_tokens & item[1]), -len(item[1])),
    )

    matched_by = "name_tokens"
    if normalized_work_name and any(normalized_work_name == variant for variant in variant_names):
        score = max(score, 0.94)
        matched_by = "name_variant"
    elif normalized_work_name and any(
        normalized_work_name in variant or variant in normalized_work_name
        for variant in variant_names
        if variant
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

    if best.matched_by in {"code", "embedded_code"}:
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
