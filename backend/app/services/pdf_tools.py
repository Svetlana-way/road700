from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Sequence

from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError


PAGE_WIDTH = 1654
PAGE_HEIGHT = 2339
PAGE_MARGIN_X = 118
PAGE_MARGIN_TOP = 110
PAGE_MARGIN_BOTTOM = 120
PAGE_BODY_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2
TEXT_FILL = "#141414"
SECTION_FILL = "#0F4C81"
PAGE_BACKGROUND = "#FFFFFF"

FONT_CANDIDATES = (
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
)


def merge_images_to_pdf(uploaded_images: Sequence[tuple[str, bytes]]) -> bytes:
    if not uploaded_images:
        raise ValueError("No images were provided for PDF merge")

    normalized_pages: list[Image.Image] = []
    try:
        for _, payload in uploaded_images:
            try:
                with Image.open(BytesIO(payload)) as image:
                    normalized_pages.append(_normalize_pdf_page(image))
            except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
                raise ValueError("Один из выбранных файлов не удалось прочитать как изображение") from error

        output = BytesIO()
        first_page, *other_pages = normalized_pages
        first_page.save(output, format="PDF", save_all=True, append_images=other_pages, resolution=150.0)
        return output.getvalue()
    finally:
        for page in normalized_pages:
            page.close()


def render_text_report_pdf(title: str, sections: Sequence[tuple[str, Sequence[str]]], *, subtitle: str | None = None) -> bytes:
    pages: list[Image.Image] = []
    current_page = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), PAGE_BACKGROUND)
    pages.append(current_page)
    draw = ImageDraw.Draw(current_page)
    title_font = _load_font(46)
    subtitle_font = _load_font(24)
    section_font = _load_font(28)
    body_font = _load_font(23)

    y = PAGE_MARGIN_TOP

    def line_height(font: ImageFont.ImageFont, *, extra: int = 0) -> int:
        bbox = draw.textbbox((0, 0), "Ag", font=font)
        return (bbox[3] - bbox[1]) + extra

    def new_page() -> None:
        nonlocal current_page, draw, y
        current_page = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), PAGE_BACKGROUND)
        pages.append(current_page)
        draw = ImageDraw.Draw(current_page)
        y = PAGE_MARGIN_TOP

    def ensure_space(required_height: int) -> None:
        nonlocal y
        if y + required_height <= PAGE_HEIGHT - PAGE_MARGIN_BOTTOM:
            return
        new_page()

    def write_wrapped_text(text: str, font: ImageFont.ImageFont, *, fill: str = TEXT_FILL, extra_gap: int = 0) -> None:
        nonlocal y
        wrapped_lines = _wrap_text(draw, text, font, PAGE_BODY_WIDTH)
        line_step = line_height(font, extra=6)
        ensure_space(max(line_step, line_step * len(wrapped_lines) + extra_gap))
        for line in wrapped_lines:
            draw.text((PAGE_MARGIN_X, y), line, fill=fill, font=font)
            y += line_step
        y += extra_gap

    write_wrapped_text(title, title_font, extra_gap=10)
    if subtitle:
        write_wrapped_text(subtitle, subtitle_font, fill="#4D4D4D", extra_gap=18)

    for section_title, lines in sections:
        if not lines:
            continue
        write_wrapped_text(section_title, section_font, fill=SECTION_FILL, extra_gap=8)
        for line in lines:
            write_wrapped_text(line, body_font, extra_gap=2)
        y += 12

    output = BytesIO()
    try:
        first_page, *other_pages = pages
        first_page.save(output, format="PDF", save_all=True, append_images=other_pages, resolution=150.0)
        return output.getvalue()
    finally:
        for page in pages:
            page.close()


def _normalize_pdf_page(image: Image.Image) -> Image.Image:
    normalized = ImageOps.exif_transpose(image)
    if normalized.mode == "RGB":
        return normalized.copy()

    if normalized.mode in {"RGBA", "LA"} or "transparency" in normalized.info:
        rgb_base = Image.new("RGB", normalized.size, PAGE_BACKGROUND)
        alpha = normalized.getchannel("A") if "A" in normalized.getbands() else None
        rgb_base.paste(normalized.convert("RGB"), mask=alpha)
        return rgb_base

    return normalized.convert("RGB")


@lru_cache(maxsize=1)
def _resolve_font_path() -> str | None:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    return None


def _load_font(size: int) -> ImageFont.ImageFont:
    font_path = _resolve_font_path()
    if font_path is None:
        return ImageFont.load_default()
    return ImageFont.truetype(font_path, size=size)


def _measure_text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> int:
    if not text:
        return 0
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in str(text).splitlines() or [""]:
        if not paragraph.strip():
            lines.append("")
            continue

        current_line = ""
        for word in paragraph.split():
            candidate = word if not current_line else f"{current_line} {word}"
            if _measure_text_width(draw, candidate, font) <= max_width:
                current_line = candidate
                continue

            if current_line:
                lines.append(current_line)
                current_line = word
                continue

            broken_word = _break_long_token(draw, word, font, max_width)
            lines.extend(broken_word[:-1])
            current_line = broken_word[-1]

        if current_line:
            lines.append(current_line)

    return lines or [""]


def _break_long_token(
    draw: ImageDraw.ImageDraw,
    token: str,
    font: ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    chunks: list[str] = []
    current_chunk = ""
    for character in token:
        candidate = f"{current_chunk}{character}"
        if current_chunk and _measure_text_width(draw, candidate, font) > max_width:
            chunks.append(current_chunk)
            current_chunk = character
        else:
            current_chunk = candidate
    if current_chunk:
        chunks.append(current_chunk)
    return chunks or [token]
