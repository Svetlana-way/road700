from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from app.core.paths import PROJECT_ROOT

DEFAULT_SOURCE_DIR = PROJECT_ROOT / "Заказ-наряды"
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "OCR_QUALITY_REPORT.md"
SUPPORTED_SUFFIXES = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"}
FOLDER_NAME_CHAR_TRANSLATION = str.maketrans(
    {
        "а": "a",
        "А": "A",
        "в": "b",
        "В": "B",
        "е": "e",
        "Е": "E",
        "к": "k",
        "К": "K",
        "м": "m",
        "М": "M",
        "н": "h",
        "Н": "H",
        "о": "o",
        "О": "O",
        "р": "p",
        "Р": "P",
        "с": "c",
        "С": "C",
        "т": "t",
        "Т": "T",
        "у": "y",
        "У": "Y",
        "х": "x",
        "Х": "X",
    }
)


@dataclass
class AuditRow:
    service_label: str
    profile_scope: str
    relative_path: str
    source_type: str
    extract_source: str
    extract_failure_reason: str | None
    extracted_fields: dict[str, object]
    manual_review_reasons: list[str]
    works_count: int
    parts_count: int
    invoice_only: bool = False


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Audit OCR quality on local sample documents")
    parser.add_argument("--path", default=str(DEFAULT_SOURCE_DIR), help="Folder with source sample documents")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_PATH), help="Markdown output file path")
    return parser


def iter_source_files(source_dir: Path) -> list[Path]:
    files = [
        path
        for path in source_dir.rglob("*")
        if path.is_file() and not path.name.startswith(".") and path.suffix.lower() in SUPPORTED_SUFFIXES
    ]
    return sorted(files)


def detect_source_type(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        return "pdf"
    return "image"


def infer_service_label(path: Path) -> str:
    folder_name = path.parent.name.strip()
    normalized_folder = folder_name.lower()
    translated_folder = folder_name.translate(FOLDER_NAME_CHAR_TRANSLATION).lower()
    if "axb" in normalized_folder or "axb" in translated_folder or "ахв" in normalized_folder:
        return "AXB"
    if "антарес" in normalized_folder:
        return "Антарес"
    if "грузовые резервы" in normalized_folder:
        return "Грузовые резервы"
    if "етс" in normalized_folder:
        return "ЕТС"
    if "лидер" in normalized_folder:
        return "ЛидерТрак"
    if "логистика" in normalized_folder:
        return "Логистика"
    if "сибтракскан" in normalized_folder:
        return "СибТракСкан"
    return folder_name


def infer_profile_scope(path: Path, text: str) -> str:
    service_label = infer_service_label(path)
    normalized_text = text.lower()
    if service_label == "AXB":
        return "axb"
    if service_label == "Антарес":
        return "antares"
    if service_label == "Грузовые резервы":
        return "gruzovye_rezervy"
    if service_label == "ЛидерТрак":
        return "leader_trak"
    if service_label == "Логистика":
        return "logistics"
    if service_label == "СибТракСкан":
        return "sibtrakscan"
    if service_label == "ЕТС":
        if "акт выполненных работ" in normalized_text:
            return "ets_act"
        if "счет-фактура" in normalized_text or "счет на оплату" in normalized_text or "счет №" in normalized_text:
            return "ets_invoice"
        return "ets_act"
    return "default"


def pct(part: int, total: int) -> str:
    if total <= 0:
        return "0%"
    return f"{round(part / total * 100):d}%"


def build_doc_flags(row: AuditRow) -> dict[str, bool]:
    fields = row.extracted_fields
    order_number_ok = bool(fields.get("order_number")) or row.invoice_only
    mileage_ok = fields.get("mileage") is not None or row.invoice_only
    work_total_ok = fields.get("work_total") is not None or row.invoice_only
    works_lines_ok = row.works_count > 0 or row.invoice_only
    return {
        "order_number": order_number_ok,
        "repair_date": bool(fields.get("repair_date")),
        "service_name": bool(fields.get("service_name")),
        "plate_number": bool(fields.get("plate_number")),
        "vin": bool(fields.get("vin")),
        "mileage": mileage_ok,
        "work_total": work_total_ok,
        "parts_total": fields.get("parts_total") is not None,
        "grand_total": fields.get("grand_total") is not None,
        "vat_total": fields.get("vat_total") is not None,
        "works_lines": works_lines_ok,
        "parts_lines": row.parts_count > 0,
        "manual_review_free": len(row.manual_review_reasons) == 0,
    }


def format_project_path(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def audit_documents(source_dir: Path) -> list[AuditRow]:
    from app.services.document_processing import (
        extract_document_text,
        is_gruzovye_rezervy_invoice_only_document,
        parse_document_text,
    )

    rows: list[AuditRow] = []
    for path in iter_source_files(source_dir):
        source_type = detect_source_type(path)
        text, extract_source, extract_failure_reason = extract_document_text(path, source_type)
        profile_scope = infer_profile_scope(path, text or "")
        parsed = parse_document_text(text, db=None, profile_scope=profile_scope) if text else {
            "extracted_fields": {},
            "manual_review_reasons": ["text_missing"],
            "extracted_items": {"works": [], "parts": []},
        }
        extracted_items = parsed.get("extracted_items") if isinstance(parsed.get("extracted_items"), dict) else {}
        works = extracted_items.get("works") if isinstance(extracted_items.get("works"), list) else []
        parts = extracted_items.get("parts") if isinstance(extracted_items.get("parts"), list) else []
        invoice_only = profile_scope == "gruzovye_rezervy" and is_gruzovye_rezervy_invoice_only_document(text or "")
        rows.append(
            AuditRow(
                service_label=infer_service_label(path),
                profile_scope=profile_scope,
                relative_path=format_project_path(path),
                source_type=source_type,
                extract_source=extract_source,
                extract_failure_reason=extract_failure_reason,
                extracted_fields=parsed.get("extracted_fields") if isinstance(parsed.get("extracted_fields"), dict) else {},
                manual_review_reasons=[str(item) for item in parsed.get("manual_review_reasons", [])],
                works_count=len(works),
                parts_count=len(parts),
                invoice_only=invoice_only,
            )
        )
    return rows


def build_summary_section(rows: list[AuditRow], *, source_dir: Path) -> list[str]:
    lines = [
        "# OCR Quality Report",
        "",
        f"Источник: `{format_project_path(source_dir)}`",
        "",
        "## Summary by Service",
        "",
        "| Service | Profile | Docs | Order | Plate | VIN | Mileage | Work total | Parts total | Grand total | Work lines | Part lines | Manual review free |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]

    grouped: dict[tuple[str, str], list[AuditRow]] = defaultdict(list)
    for row in rows:
        grouped[(row.service_label, row.profile_scope)].append(row)

    for (service_label, profile_scope), group_rows in sorted(grouped.items()):
        flags = [build_doc_flags(row) for row in group_rows]
        lines.append(
            "| "
            + " | ".join(
                [
                    service_label,
                    profile_scope,
                    str(len(group_rows)),
                    pct(sum(flag["order_number"] for flag in flags), len(group_rows)),
                    pct(sum(flag["plate_number"] for flag in flags), len(group_rows)),
                    pct(sum(flag["vin"] for flag in flags), len(group_rows)),
                    pct(sum(flag["mileage"] for flag in flags), len(group_rows)),
                    pct(sum(flag["work_total"] for flag in flags), len(group_rows)),
                    pct(sum(flag["parts_total"] for flag in flags), len(group_rows)),
                    pct(sum(flag["grand_total"] for flag in flags), len(group_rows)),
                    pct(sum(flag["works_lines"] for flag in flags), len(group_rows)),
                    pct(sum(flag["parts_lines"] for flag in flags), len(group_rows)),
                    pct(sum(flag["manual_review_free"] for flag in flags), len(group_rows)),
                ]
            )
            + " |"
        )
    return lines


def build_priority_section(rows: list[AuditRow]) -> list[str]:
    grouped: dict[tuple[str, str], list[AuditRow]] = defaultdict(list)
    for row in rows:
        grouped[(row.service_label, row.profile_scope)].append(row)

    scored_rows: list[tuple[int, str, str, int, list[str]]] = []
    for (service_label, profile_scope), group_rows in grouped.items():
        flags = [build_doc_flags(row) for row in group_rows]
        total = len(group_rows)
        missing_line_docs = total - sum(flag["works_lines"] and flag["parts_lines"] for flag in flags)
        manual_review_docs = total - sum(flag["manual_review_free"] for flag in flags)
        missing_financial_docs = total - sum(flag["grand_total"] and flag["work_total"] and flag["parts_total"] for flag in flags)
        score = missing_line_docs * 3 + manual_review_docs * 2 + missing_financial_docs

        reason_counter: Counter[str] = Counter()
        for row in group_rows:
            reason_counter.update(row.manual_review_reasons)
        top_reasons = [reason for reason, _count in reason_counter.most_common(3)]
        scored_rows.append((score, service_label, profile_scope, total, top_reasons))

    scored_rows.sort(key=lambda item: (-item[0], item[1], item[2]))
    lines = ["", "## Priority Queue", ""]
    for score, service_label, profile_scope, total, reasons in scored_rows:
        if score <= 0:
            continue
        reasons_text = ", ".join(reasons) if reasons else "line_items_missing"
        lines.append(f"- `{service_label}` / `{profile_scope}`: score {score} on {total} docs. Main issues: {reasons_text}.")
    if len(lines) == 3:
        lines.append("- No obvious problem clusters found in the current sample set.")
    return lines


def build_document_details(rows: list[AuditRow]) -> list[str]:
    lines = ["", "## Document Details", ""]
    for row in rows:
        fields = row.extracted_fields
        reasons = ", ".join(row.manual_review_reasons) if row.manual_review_reasons else "-"
        lines.extend(
            [
                f"### `{row.relative_path}`",
                "",
                f"- Service: `{row.service_label}`",
                f"- Profile: `{row.profile_scope}`",
                f"- Extract source: `{row.extract_source}`",
                f"- Extract failure: `{row.extract_failure_reason or '-'}`",
                f"- Header: order `{fields.get('order_number', '-')}`, date `{fields.get('repair_date', '-')}`, plate `{fields.get('plate_number', '-')}`, vin `{fields.get('vin', '-')}`, mileage `{fields.get('mileage', '-')}`",
                f"- Totals: work `{fields.get('work_total', '-')}`, parts `{fields.get('parts_total', '-')}`, vat `{fields.get('vat_total', '-')}`, grand `{fields.get('grand_total', '-')}`",
                f"- Line items: works `{row.works_count}`, parts `{row.parts_count}`",
                f"- Manual review: `{reasons}`",
                "",
            ]
        )
    return lines


def render_report(rows: list[AuditRow], *, source_dir: Path = DEFAULT_SOURCE_DIR) -> str:
    sections: list[str] = []
    sections.extend(build_summary_section(rows, source_dir=source_dir))
    sections.extend(build_priority_section(rows))
    sections.extend(build_document_details(rows))
    return "\n".join(sections).strip() + "\n"


def main() -> None:
    parser = build_argument_parser()
    args = parser.parse_args()

    source_dir = Path(args.path).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    if not source_dir.exists():
        raise FileNotFoundError(f"Sample folder not found: {source_dir}")

    rows = audit_documents(source_dir)
    report_text = render_report(rows, source_dir=source_dir)
    output_path.write_text(report_text, encoding="utf-8")
    print(f"Wrote OCR quality report for {len(rows)} documents to {output_path}")


if __name__ == "__main__":
    main()
