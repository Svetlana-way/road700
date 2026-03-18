from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from xml.etree import ElementTree

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.paths import PROJECT_ROOT
from app.models.enums import ServiceStatus
from app.models.service import Service


DOCX_TEXT_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
LEGAL_FORM_PATTERN = re.compile(r"\b(?:ооо|ао|пао|зао|ип)\b", re.IGNORECASE)
LONG_LEGAL_FORM_PATTERN = re.compile(
    r"\bобщество\s*с\s*ограниченной\s*ответственностью\b",
    re.IGNORECASE,
)
NON_ALNUM_PATTERN = re.compile(r"[^0-9a-zа-я]+", re.IGNORECASE)
SERVICE_ALIASES = {
    "ООО «Енисей Трак Сервис»": ("ЕТС", "Енисей", "Енисей Трак Сервис"),
    "ООО «ЛидерТрак»": ("Лидер Трак", "Лидертрак"),
}


@dataclass(frozen=True)
class ServiceCatalogEntry:
    name: str
    city: str | None
    contact: str | None
    comment: str
    aliases: tuple[str, ...]


@dataclass(frozen=True)
class ServiceLookupEntry:
    name: str
    aliases: tuple[str, ...]


def get_service_catalog_dir() -> Path:
    return PROJECT_ROOT / "Сервисы"


def normalize_service_key(value: str | None) -> str:
    if not value:
        return ""
    normalized = value.lower().replace("ё", "е")
    normalized = LONG_LEGAL_FORM_PATTERN.sub(" ", normalized)
    normalized = LEGAL_FORM_PATTERN.sub(" ", normalized)
    normalized = NON_ALNUM_PATTERN.sub("", normalized)
    return normalized.strip()


def read_docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        document_xml = archive.read("word/document.xml")
    root = ElementTree.fromstring(document_xml)
    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", DOCX_TEXT_NAMESPACE):
        text_parts = [
            node.text.strip()
            for node in paragraph.findall(".//w:t", DOCX_TEXT_NAMESPACE)
            if node.text and node.text.strip()
        ]
        if text_parts:
            paragraphs.append("".join(text_parts))
    return "\n".join(paragraphs)


def extract_value(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
    if match is None:
        return None
    value = match.group(1).strip()
    return value or None


def extract_city(address: str | None) -> str | None:
    if not address:
        return None
    match = re.search(r"г\.\s*([^,]+)", address, re.IGNORECASE)
    if match is None:
        return None
    value = match.group(1).strip()
    return value or None


def strip_legal_form(name: str) -> str:
    normalized = LONG_LEGAL_FORM_PATTERN.sub(" ", name)
    normalized = LEGAL_FORM_PATTERN.sub(" ", normalized)
    normalized = normalized.replace("«", " ").replace("»", " ").replace('"', " ")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized or name.strip()


def build_service_aliases(
    name: str,
    *,
    file_name: str | None = None,
    extra_aliases: tuple[str, ...] = (),
) -> tuple[str, ...]:
    short_name = strip_legal_form(name)
    aliases: list[str] = [name, short_name]

    if file_name:
        aliases.append(file_name)
    if short_name:
        aliases.append(short_name.replace(" ", ""))
        parts = [item for item in re.split(r"\s+", short_name) if item]
        if len(parts) >= 2:
            aliases.append(" ".join(parts))
        initials = "".join(part[0] for part in parts if part)
        if len(initials) >= 3:
            aliases.append(initials.upper())

    aliases.extend(extra_aliases)
    return tuple(
        dict.fromkeys(alias.strip() for alias in aliases if isinstance(alias, str) and alias.strip())
    )


def build_comment(fields: dict[str, str | None]) -> str:
    lines = [
        f"Юрлицо: {fields['name']}",
        f"Адрес: {fields['address']}" if fields["address"] else None,
        f"ИНН/КПП: {fields['inn_kpp']}" if fields["inn_kpp"] else None,
        f"ОГРН: {fields['ogrn']}" if fields["ogrn"] else None,
        f"Банк: {fields['bank']}" if fields["bank"] else None,
        f"Расчётный счёт: {fields['account']}" if fields["account"] else None,
        f"Корр. счёт: {fields['corr_account']}" if fields["corr_account"] else None,
        f"БИК: {fields['bik']}" if fields["bik"] else None,
        f"Телефон: {fields['phone']}" if fields["phone"] else None,
        f"Email: {fields['email']}" if fields["email"] else None,
        f"Директор: {fields['director']}" if fields["director"] else None,
        "Источник: папка `Сервисы`",
    ]
    return "\n".join(line for line in lines if line)


def build_contact(fields: dict[str, str | None]) -> str | None:
    parts = [fields["phone"], fields["email"]]
    contact = " | ".join(part for part in parts if part)
    return contact or None


def build_entry(path: Path) -> ServiceCatalogEntry:
    text = read_docx_text(path)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        raise ValueError(f"Service card is empty: {path}")

    name = lines[0]
    address = extract_value(text, r"Адрес:\s*(.+)")
    fields = {
        "name": name,
        "address": address,
        "inn_kpp": extract_value(text, r"ИНН/КПП:\s*(.+)"),
        "ogrn": extract_value(text, r"ОГРН:\s*(.+)"),
        "bank": extract_value(text, r"Банк:\s*(.+)"),
        "account": extract_value(text, r"(?:р/с|Расч[её]тный сч[её]т):\s*(.+)"),
        "corr_account": extract_value(text, r"(?:к/с|Корр\.\s*сч[её]т):\s*(.+)"),
        "bik": extract_value(text, r"БИК:\s*(.+)"),
        "phone": extract_value(text, r"Телефон:\s*(.+)"),
        "email": extract_value(text, r"Email:\s*(.+)"),
        "director": extract_value(text, r"Директор:\s*(.+)"),
    }
    file_name = path.stem.replace("_", " ")
    aliases = build_service_aliases(name, file_name=file_name, extra_aliases=SERVICE_ALIASES.get(name, ()))
    return ServiceCatalogEntry(
        name=name,
        city=extract_city(address),
        contact=build_contact(fields),
        comment=build_comment(fields),
        aliases=aliases,
    )


@lru_cache(maxsize=1)
def get_service_catalog_entries() -> tuple[ServiceCatalogEntry, ...]:
    service_dir = get_service_catalog_dir()
    if not service_dir.exists():
        return ()
    entries = [build_entry(path) for path in sorted(service_dir.glob("*.docx"))]
    return tuple(entries)


def get_service_catalog_names() -> tuple[str, ...]:
    return tuple(entry.name for entry in get_service_catalog_entries())


def get_service_lookup_entries(db: Session | None = None) -> tuple[ServiceLookupEntry, ...]:
    lookup_map: dict[str, tuple[str, ...]] = {
        entry.name: entry.aliases for entry in get_service_catalog_entries()
    }
    if db is not None:
        for service_item in db.scalars(select(Service).order_by(Service.name.asc())).all():
            aliases = build_service_aliases(service_item.name)
            existing_aliases = lookup_map.get(service_item.name, ())
            lookup_map[service_item.name] = tuple(dict.fromkeys([*existing_aliases, *aliases]))
    return tuple(
        ServiceLookupEntry(name=name, aliases=aliases)
        for name, aliases in sorted(lookup_map.items(), key=lambda item: item[0].lower())
    )


def find_service_catalog_entry(service_name: str | None) -> ServiceCatalogEntry | None:
    lookup_key = normalize_service_key(service_name)
    if not lookup_key:
        return None
    for entry in get_service_catalog_entries():
        for alias in entry.aliases:
            if normalize_service_key(alias) == lookup_key:
                return entry
    return None


def ensure_service_catalog_synced(db: Session, *, commit: bool = False) -> tuple[Service, ...]:
    services: list[Service] = []
    changed = False
    for entry in get_service_catalog_entries():
        service_item = db.scalar(select(Service).where(Service.name == entry.name))
        if service_item is None:
            service_item = Service(name=entry.name)
            changed = True
        if (
            service_item.city != entry.city
            or service_item.contact != entry.contact
            or service_item.comment != entry.comment
            or service_item.status != ServiceStatus.CONFIRMED
        ):
            changed = True
        service_item.city = entry.city
        service_item.contact = entry.contact
        service_item.comment = entry.comment
        service_item.status = ServiceStatus.CONFIRMED
        db.add(service_item)
        db.flush()
        services.append(service_item)
    if commit and changed:
        db.commit()
    return tuple(services)


def find_service_name_in_text(text: str | None, db: Session | None = None) -> tuple[str, str] | None:
    normalized_text = normalize_service_key(text)
    if not normalized_text:
        return None

    best_match: tuple[int, int, str, str] | None = None
    for entry in get_service_lookup_entries(db):
        for alias in entry.aliases:
            alias_key = normalize_service_key(alias)
            if len(alias_key) < 4:
                continue
            if alias_key not in normalized_text:
                continue
            score = (len(alias_key), 1 if alias == entry.name else 0, entry.name, alias)
            if best_match is None or score > best_match:
                best_match = score

    if best_match is None:
        return None
    return best_match[2], best_match[3]


def resolve_service_by_name(db: Session, service_name: str | None) -> Service | None:
    entry = find_service_catalog_entry(service_name)
    if entry is not None:
        ensure_service_catalog_synced(db)
        return db.scalar(select(Service).where(Service.name == entry.name))

    lookup_key = normalize_service_key(service_name)
    if not lookup_key:
        return None

    for service_item in db.scalars(select(Service).order_by(Service.name.asc())).all():
        for alias in build_service_aliases(service_item.name):
            if normalize_service_key(alias) == lookup_key:
                return service_item
    return None


def resolve_catalog_service(db: Session, service_name: str | None) -> Service | None:
    entry = find_service_catalog_entry(service_name)
    if entry is None:
        return None
    ensure_service_catalog_synced(db)
    return db.scalar(select(Service).where(Service.name == entry.name))
