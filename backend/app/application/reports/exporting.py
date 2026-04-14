from __future__ import annotations

from io import BytesIO
from typing import Iterable

from openpyxl import Workbook


def autosize_worksheet_columns(worksheet) -> None:
    for column_cells in worksheet.columns:
        max_length = 0
        column_letter = column_cells[0].column_letter
        for cell in column_cells:
            cell_value = "" if cell.value is None else str(cell.value)
            if len(cell_value) > max_length:
                max_length = len(cell_value)
        worksheet.column_dimensions[column_letter].width = min(max(max_length + 2, 12), 48)


def append_rows(worksheet, rows: Iterable[Iterable[object]]) -> None:
    for row in rows:
        worksheet.append(list(row))
    autosize_worksheet_columns(worksheet)


def workbook_to_bytes(workbook: Workbook) -> bytes:
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def safe_filename(value: str, fallback: str) -> str:
    normalized = "".join(
        char if ord(char) < 128 and (char.isalnum() or char in ("-", "_")) else "_"
        for char in value.strip()
    )
    normalized = normalized.strip("_")
    return normalized or fallback
