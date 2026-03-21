from __future__ import annotations

import argparse

from app.core.config import settings
from app.services.document_processing import ensure_ocr_runtime, format_ocr_runtime_status_lines


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate OCR runtime dependencies")
    parser.add_argument(
        "--require-full",
        action="store_true",
        help="Exit with non-zero code when image OCR or scanned PDF OCR is unavailable",
    )
    return parser


def main() -> None:
    parser = build_argument_parser()
    args = parser.parse_args()
    require_full = args.require_full or settings.require_full_ocr_runtime

    for line in format_ocr_runtime_status_lines(require_pdf_scan_ocr=require_full):
        print(line)

    if require_full:
        ensure_ocr_runtime(require_pdf_scan_ocr=True)


if __name__ == "__main__":
    main()
