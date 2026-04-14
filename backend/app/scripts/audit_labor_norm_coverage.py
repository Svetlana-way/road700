from __future__ import annotations

import argparse
import re
from collections import defaultdict
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

from sqlalchemy.orm import Session, sessionmaker

from app.application.documents.parsing_access import parse_document_text_for_application
from app.core.paths import PROJECT_ROOT, get_backend_data_root
from app.db.base import Base
from app.db.sqlite import create_sqlite_in_memory_engine
from app.models.labor_norm import LaborNorm
from app.scripts.import_labor_norms import import_labor_norms_with_session
from app.services.document_text_utils import normalize_line
from app.services.text_extraction_facade import extract_document_text
from app.services.labor_norms import (
    build_normalized_name,
    classify_known_non_catalog_operation,
    default_labor_norms_path,
    find_best_labor_norm_match,
    load_active_labor_norms,
    normalize_labor_norm_scope,
    tokenize_match_text,
)

DEFAULT_SOURCE_DIR = PROJECT_ROOT / "Заказ-наряды" / "Заказ наряды АXB"
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "AXB_LABOR_NORM_COVERAGE_REPORT.md"
SUPPORTED_SUFFIXES = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"}


@dataclass(frozen=True)
class CandidateRow:
    code: str
    name: str
    standard_hours: float
    score: float
    matched_by: str


@dataclass
class WorkAuditRow:
    relative_path: str
    work_code: Optional[str]
    work_name: str
    standard_hours: Optional[float]
    price: Optional[float]
    line_total: Optional[float]
    matched: bool
    match: Optional[CandidateRow]
    token_candidates: list[CandidateRow]
    hour_candidates: list[CandidateRow]
    unmatched_category: Optional[str]
    unmatched_reason: Optional[str]


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Audit labor norm coverage for OCR-extracted work items")
    parser.add_argument("--path", default=str(DEFAULT_SOURCE_DIR), help="Folder with source sample documents")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_PATH), help="Markdown output file path")
    parser.add_argument("--profile-scope", default="axb", help="Profile scope passed into parse_document_text")
    parser.add_argument("--labor-scope", default="dongfeng_2025", help="Labor norm scope used for matching")
    parser.add_argument("--catalog-path", default=None, help="Optional path to local labor norm catalog (.xlsx or .csv)")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of source files to audit")
    return parser


def iter_source_files(source_dir: Path) -> list[Path]:
    files = [
        path
        for path in source_dir.rglob("*")
        if path.is_file() and not path.name.startswith(".") and path.suffix.lower() in SUPPORTED_SUFFIXES
    ]
    return sorted(files)


def detect_source_type(path: Path) -> str:
    return "pdf" if path.suffix.lower() == ".pdf" else "image"


def format_project_path(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def resolve_catalog_path(labor_scope: str, catalog_path: str | None) -> Path:
    if catalog_path:
        return Path(catalog_path).expanduser().resolve()

    normalized_scope = normalize_labor_norm_scope(labor_scope) or labor_scope
    backend_data_root = get_backend_data_root()
    known_paths = {
        "dongfeng_2025": default_labor_norms_path(PROJECT_ROOT),
        "man_tgx_approx_srt_2026": backend_data_root / "labor_norms" / "man_tgx_approx_srt_2026.csv",
        "volvo_fh_approx_vstg_2026": backend_data_root / "labor_norms" / "volvo_fh_approx_vstg_2026.csv",
    }
    return known_paths.get(normalized_scope, default_labor_norms_path(PROJECT_ROOT))


@contextmanager
def build_audit_session(*, labor_scope: str, catalog_path: Path) -> Iterable[Session]:
    engine = create_sqlite_in_memory_engine(enforce_foreign_keys=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    try:
        with SessionLocal() as db:
            import_labor_norms_with_session(db, path=catalog_path, scope=labor_scope, catalog_name=labor_scope)
            yield db
    finally:
        engine.dispose()


def normalize_audit_text(value: str) -> str:
    return " ".join(tokenize_match_text(value))


def classify_unmatched_row(
    *,
    work_name: str,
    work_code: Optional[str],
    standard_hours: Optional[float],
) -> tuple[str, str]:
    raw_name = normalize_line(work_name).lower()
    normalized_name = normalize_audit_text(work_name)
    compact_name = normalized_name.replace(" ", "")
    has_structured_hint = bool(
        work_code
        and standard_hours is not None
        and len(str(work_code).strip()) >= 4
        and re.search(r"[a-zа-я]{2,}", raw_name, re.IGNORECASE)
    )
    header_patterns = (
        r"заказ[- ]наряд",
        r"к причине",
        r"\bартикул\b",
        r"\bнаименование\b",
        r"кол\.\s*оп",
        r"цена\s*н/?ч",
        r"\bнорма\b",
        r"техническ[а-я]+\s+обслужив",
    )
    footer_patterns = (
        r"\bруководител[ья]\b",
        r"\bбухгалтер\b",
        r"документо",
        r"должност",
    )
    multi_operation_markers = (
        "мойка",
        "нормокомплект",
        "ремонт",
        "топливный фильтр",
        "диагностическ",
    )
    if (
        not has_structured_hint
        and (
        not normalized_name
        or compact_name.isdigit()
        or len(normalized_name) <= 2
        or sum(char.isalpha() for char in work_name) < 3
        )
    ):
        return "ocr_noise", "строка почти не содержит осмысленного названия работы"

    if any(re.search(pattern, raw_name) for pattern in header_patterns):
        return "ocr_noise", "строка похожа на шапку, служебный текст или заголовок таблицы"

    if any(re.search(pattern, raw_name) for pattern in footer_patterns):
        return "ocr_noise", "строка похожа на подпись, должность или нижний колонтитул документа"

    if raw_name.strip(" .,:;|/-") == "ремонт" or re.fullmatch(r"[\d\s,./-]*ремонт", raw_name):
        return "ocr_noise", "строка содержит только общий тип операции без названия работы"

    if re.match(r"^\d+[,.]\d+", raw_name) and sum(marker in raw_name for marker in multi_operation_markers) >= 2:
        return "ocr_noise", "строка склеена из нескольких операций или числовых колонок OCR"

    is_non_catalog_service, non_catalog_reason = classify_known_non_catalog_operation(
        work_code=work_code,
        work_name=work_name,
    )
    if is_non_catalog_service:
        return "service_outside_catalog", non_catalog_reason or "операция вне каталога нормо-часов"

    if work_code and str(work_code).strip() in {"00", "01", "02", "100", "32300", "700700", "150000"}:
        return "service_outside_catalog", "код похож на локальный код сервиса, а не на код нормы производителя"

    return "catalog_gap", "работа выглядит осмысленной, но не находится в каталоге нормо-часов"


def format_unmatched_category(value: Optional[str]) -> str:
    if value == "ocr_noise":
        return "OCR noise"
    if value == "service_outside_catalog":
        return "Outside catalog"
    if value == "catalog_gap":
        return "Catalog gap"
    return "-"


def build_token_candidates(
    work_name: str,
    *,
    norms: Iterable[LaborNorm],
    limit: int = 5,
) -> list[CandidateRow]:
    work_tokens = set(tokenize_match_text(work_name))
    if not work_tokens:
        return []

    candidates: list[CandidateRow] = []
    normalized_work_name = build_normalized_name(work_name)
    for norm in norms:
        norm_tokens = set((norm.normalized_name or "").split())
        if not norm_tokens:
            norm_tokens = set(tokenize_match_text(norm.name_ru))
        intersections = work_tokens & norm_tokens
        if not intersections:
            continue

        coverage = len(intersections) / len(work_tokens)
        specificity = len(intersections) / len(norm_tokens)
        score = round(coverage * 0.75 + specificity * 0.25, 4)
        matched_by = "tokens"
        if normalized_work_name and normalized_work_name == norm.normalized_name:
            score = max(score, 0.94)
            matched_by = "normalized_name"
        elif normalized_work_name and (
            normalized_work_name in norm.normalized_name or norm.normalized_name in normalized_work_name
        ):
            score = min(0.93, score + 0.08)
            matched_by = "name_contains"

        candidates.append(
            CandidateRow(
                code=norm.code,
                name=norm.name_ru,
                standard_hours=float(norm.standard_hours),
                score=score,
                matched_by=matched_by,
            )
        )

    candidates.sort(key=lambda item: (item.score, item.standard_hours, item.code), reverse=True)
    return candidates[:limit]


def build_hour_candidates(
    standard_hours: Optional[float],
    *,
    norms: Iterable[LaborNorm],
    limit: int = 5,
) -> list[CandidateRow]:
    if standard_hours is None:
        return []

    candidates = sorted(
        (
            CandidateRow(
                code=norm.code,
                name=norm.name_ru,
                standard_hours=float(norm.standard_hours),
                score=round(abs(float(norm.standard_hours) - standard_hours), 4),
                matched_by="standard_hours_distance",
            )
            for norm in norms
        ),
        key=lambda item: (item.score, item.code),
    )
    return candidates[:limit]


def audit_documents(
    source_dir: Path,
    *,
    profile_scope: str,
    labor_scope: str,
    limit: Optional[int],
    db: Session,
) -> list[WorkAuditRow]:
    norms = list(load_active_labor_norms(db, scope=normalize_labor_norm_scope(labor_scope)))
    rows: list[WorkAuditRow] = []
    files = iter_source_files(source_dir)
    if limit is not None:
        files = files[:limit]
    for path in files:
        text, _extract_source, _extract_failure_reason = extract_document_text(path, detect_source_type(path))
        parsed = parse_document_text_for_application(text, db=None, profile_scope=profile_scope) if text else {
            "extracted_items": {"works": []},
        }
        works = parsed.get("extracted_items", {}).get("works", [])
        for item in works:
            work_name = str(item.get("work_name") or "").strip()
            if not work_name:
                continue
            standard_hours = float(item["standard_hours"]) if item.get("standard_hours") is not None else None
            work_code = str(item.get("work_code")) if item.get("work_code") else None
            unmatched_category, unmatched_reason = classify_unmatched_row(
                work_name=work_name,
                work_code=work_code,
                standard_hours=standard_hours,
            )
            match = find_best_labor_norm_match(
                db,
                work_code=work_code,
                work_name=work_name,
                scope=labor_scope,
            ) if unmatched_category != "ocr_noise" else None
            rows.append(
                WorkAuditRow(
                    relative_path=format_project_path(path),
                    work_code=work_code,
                    work_name=work_name,
                    standard_hours=standard_hours,
                    price=float(item["price"]) if item.get("price") is not None else None,
                    line_total=float(item["line_total"]) if item.get("line_total") is not None else None,
                    matched=match is not None,
                    match=(
                        CandidateRow(
                            code=match.norm.code,
                            name=match.norm.name_ru,
                            standard_hours=float(match.norm.standard_hours),
                            score=match.score,
                            matched_by=match.matched_by,
                        )
                        if match is not None
                        else None
                    ),
                    token_candidates=[] if match is not None or unmatched_category != "catalog_gap" else build_token_candidates(work_name, norms=norms),
                    hour_candidates=[] if match is not None or unmatched_category != "catalog_gap" else build_hour_candidates(standard_hours, norms=norms),
                    unmatched_category=None if match is not None else unmatched_category,
                    unmatched_reason=None if match is not None else unmatched_reason,
                )
            )
    return rows


def build_summary_section(rows: list[WorkAuditRow], *, source_dir: Path, labor_scope: str) -> list[str]:
    total = len(rows)
    matched = sum(row.matched for row in rows)
    unmatched_rows = [row for row in rows if not row.matched]
    ocr_noise_count = sum(row.unmatched_category == "ocr_noise" for row in unmatched_rows)
    outside_catalog_count = sum(row.unmatched_category == "service_outside_catalog" for row in unmatched_rows)
    catalog_gap_count = sum(row.unmatched_category == "catalog_gap" for row in unmatched_rows)
    reference_ready_total = total - ocr_noise_count
    docs_total = len({row.relative_path for row in rows})
    docs_with_matches = len({row.relative_path for row in rows if row.matched})
    docs_without_matches = docs_total - docs_with_matches
    lines = [
        "# AXB Labor Norm Coverage Report",
        "",
        f"Источник: `{format_project_path(source_dir)}`",
        f"Каталог нормо-часов: `{labor_scope}`",
        "",
        "## Summary",
        "",
        f"- Documents scanned: `{docs_total}`",
        f"- Work rows scanned: `{total}`",
        f"- Matched rows: `{matched}`",
        f"- Unmatched rows: `{total - matched}`",
        f"- Coverage: `{round((matched / total) * 100):d}%`" if total else "- Coverage: `0%`",
        (
            f"- Coverage without OCR noise: `{round((matched / reference_ready_total) * 100):d}%`"
            if reference_ready_total > 0
            else "- Coverage without OCR noise: `0%`"
        ),
        f"- OCR noise rows: `{ocr_noise_count}`",
        f"- Outside catalog rows: `{outside_catalog_count}`",
        f"- Catalog gap rows: `{catalog_gap_count}`",
        f"- Docs with at least one match: `{docs_with_matches}`",
        f"- Docs without any matches: `{docs_without_matches}`",
    ]
    return lines


def build_unmatched_clusters_section(rows: list[WorkAuditRow], *, category: str, title: str) -> list[str]:
    clusters: dict[tuple[Optional[str], str, Optional[float]], list[WorkAuditRow]] = defaultdict(list)
    for row in rows:
        if row.matched or row.unmatched_category != category:
            continue
        clusters[(row.work_code, row.work_name, row.standard_hours)].append(row)

    lines = ["", f"## {title}", ""]
    if not clusters:
        lines.append("- No rows in this category.")
        return lines

    sorted_clusters = sorted(
        clusters.items(),
        key=lambda item: (-len(item[1]), item[0][1], item[0][0] or ""),
    )
    for (work_code, work_name, standard_hours), cluster_rows in sorted_clusters:
        sample_paths = ", ".join(sorted({row.relative_path for row in cluster_rows})[:3])
        token_candidates = cluster_rows[0].token_candidates
        hour_candidates = cluster_rows[0].hour_candidates
        lines.append(
            f"- `{work_name}` | code `{work_code or '-'}` | hours `{standard_hours if standard_hours is not None else '-'}` | rows `{len(cluster_rows)}` | docs: {sample_paths}"
        )
        if cluster_rows[0].unmatched_reason:
            lines.append(f"  reason: {cluster_rows[0].unmatched_reason}")
        if category == "catalog_gap" and token_candidates:
            formatted = "; ".join(
                f"`{item.code}` {item.name} ({item.standard_hours} ч, score {item.score}, {item.matched_by})"
                for item in token_candidates[:3]
            )
            lines.append(f"  token candidates: {formatted}")
        elif category == "catalog_gap":
            lines.append("  token candidates: none")
        if category == "catalog_gap" and hour_candidates:
            formatted = "; ".join(
                f"`{item.code}` {item.name} ({item.standard_hours} ч, delta {item.score})"
                for item in hour_candidates[:3]
            )
            lines.append(f"  hour candidates: {formatted}")
        elif category == "catalog_gap":
            lines.append("  hour candidates: none")
    return lines


def build_document_section(rows: list[WorkAuditRow]) -> list[str]:
    lines = ["", "## Document Details", ""]
    grouped: dict[str, list[WorkAuditRow]] = defaultdict(list)
    for row in rows:
        grouped[row.relative_path].append(row)

    for relative_path, doc_rows in sorted(grouped.items()):
        matched = sum(row.matched for row in doc_rows)
        lines.append(f"### `{relative_path}`")
        lines.append("")
        lines.append(f"- Coverage: `{matched}/{len(doc_rows)}`")
        for row in doc_rows:
            if row.matched and row.match is not None:
                lines.append(
                    f"- MATCH `{row.work_name}` -> `{row.match.code}` {row.match.name} ({row.match.standard_hours} ч, {row.match.matched_by}, score {row.match.score})"
                )
            else:
                lines.append(
                    f"- MISS [{format_unmatched_category(row.unmatched_category)}] `{row.work_name}` | code `{row.work_code or '-'}` | hours `{row.standard_hours if row.standard_hours is not None else '-'}` | total `{row.line_total if row.line_total is not None else '-'}`"
                )
        lines.append("")
    return lines


def render_report(rows: list[WorkAuditRow], *, source_dir: Path, labor_scope: str) -> str:
    sections: list[str] = []
    sections.extend(build_summary_section(rows, source_dir=source_dir, labor_scope=labor_scope))
    sections.extend(build_unmatched_clusters_section(rows, category="ocr_noise", title="OCR Noise Clusters"))
    sections.extend(
        build_unmatched_clusters_section(rows, category="service_outside_catalog", title="Outside Catalog Clusters")
    )
    sections.extend(build_unmatched_clusters_section(rows, category="catalog_gap", title="Catalog Gap Clusters"))
    sections.extend(build_document_section(rows))
    return "\n".join(sections).strip() + "\n"


def main() -> None:
    parser = build_argument_parser()
    args = parser.parse_args()

    source_dir = Path(args.path).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    catalog_path = resolve_catalog_path(str(args.labor_scope), args.catalog_path)
    if not source_dir.exists():
        raise FileNotFoundError(f"Sample folder not found: {source_dir}")
    if not catalog_path.exists():
        raise FileNotFoundError(f"Labor norm catalog not found: {catalog_path}")

    with build_audit_session(labor_scope=str(args.labor_scope), catalog_path=catalog_path) as db:
        rows = audit_documents(
            source_dir,
            profile_scope=str(args.profile_scope),
            labor_scope=str(args.labor_scope),
            limit=args.limit,
            db=db,
        )

    report_text = render_report(rows, source_dir=source_dir, labor_scope=str(args.labor_scope))
    output_path.write_text(report_text, encoding="utf-8")
    print(f"Wrote labor norm coverage report for {len(rows)} work rows to {output_path}")


if __name__ == "__main__":
    main()
