from __future__ import annotations

from app.application.services import service_catalog as _impl


DOCX_TEXT_NAMESPACE = _impl.DOCX_TEXT_NAMESPACE
logger = _impl.logger
LEGAL_FORM_PATTERN = _impl.LEGAL_FORM_PATTERN
LONG_LEGAL_FORM_PATTERN = _impl.LONG_LEGAL_FORM_PATTERN
NON_ALNUM_PATTERN = _impl.NON_ALNUM_PATTERN
SERVICE_ALIASES = _impl.SERVICE_ALIASES
FALLBACK_SERVICE_CATALOG_DEFINITIONS = _impl.FALLBACK_SERVICE_CATALOG_DEFINITIONS
ServiceCatalogEntry = _impl.ServiceCatalogEntry
ServiceLookupEntry = _impl.ServiceLookupEntry

_GET_SERVICE_CATALOG_DIR = _impl.get_service_catalog_dir
_GET_SERVICE_CATALOG_ENTRIES = _impl.get_service_catalog_entries
_GET_SERVICE_CATALOG_NAMES = _impl.get_service_catalog_names
_GET_SERVICE_LOOKUP_ENTRIES = _impl.get_service_lookup_entries
_FIND_SERVICE_CATALOG_ENTRY = _impl.find_service_catalog_entry
_ENSURE_SERVICE_CATALOG_SYNCED = _impl.ensure_service_catalog_synced
_FIND_SERVICE_NAME_IN_TEXT = _impl.find_service_name_in_text
_RESOLVE_SERVICE_BY_NAME = _impl.resolve_service_by_name
_RESOLVE_CATALOG_SERVICE = _impl.resolve_catalog_service


def _bind_legacy_overrides() -> None:
    _impl.logger = logger
    _impl.get_service_catalog_dir = get_service_catalog_dir
    _impl.get_service_catalog_entries = get_service_catalog_entries
    _impl.get_service_catalog_names = get_service_catalog_names
    _impl.get_service_lookup_entries = get_service_lookup_entries
    _impl.find_service_catalog_entry = find_service_catalog_entry


def get_service_catalog_dir():
    return _GET_SERVICE_CATALOG_DIR()


def normalize_service_key(value: str | None) -> str:
    return _impl.normalize_service_key(value)


def read_docx_text(path):
    return _impl.read_docx_text(path)


def extract_value(text: str, pattern: str) -> str | None:
    return _impl.extract_value(text, pattern)


def extract_city(address: str | None) -> str | None:
    return _impl.extract_city(address)


def strip_legal_form(name: str) -> str:
    return _impl.strip_legal_form(name)


def build_service_aliases(
    name: str,
    *,
    file_name: str | None = None,
    extra_aliases: tuple[str, ...] = (),
) -> tuple[str, ...]:
    return _impl.build_service_aliases(name, file_name=file_name, extra_aliases=extra_aliases)


def build_comment(fields: dict[str, str | None]) -> str:
    return _impl.build_comment(fields)


def build_contact(fields: dict[str, str | None]) -> str | None:
    return _impl.build_contact(fields)


def build_entry(path):
    return _impl.build_entry(path)


def build_fallback_entry(definition: dict[str, object]):
    return _impl.build_fallback_entry(definition)


def get_service_catalog_entries():
    _impl.logger = logger
    _impl.get_service_catalog_dir = get_service_catalog_dir
    return _GET_SERVICE_CATALOG_ENTRIES()


get_service_catalog_entries.cache_clear = _GET_SERVICE_CATALOG_ENTRIES.cache_clear
get_service_catalog_entries.cache_info = _GET_SERVICE_CATALOG_ENTRIES.cache_info


def get_service_catalog_names():
    _bind_legacy_overrides()
    return _GET_SERVICE_CATALOG_NAMES()


def get_service_lookup_entries(db=None):
    _bind_legacy_overrides()
    return _GET_SERVICE_LOOKUP_ENTRIES(db)


def find_service_catalog_entry(service_name: str | None):
    _bind_legacy_overrides()
    return _FIND_SERVICE_CATALOG_ENTRY(service_name)


def ensure_service_catalog_synced(db, *, commit: bool = False):
    _bind_legacy_overrides()
    return _ENSURE_SERVICE_CATALOG_SYNCED(db, commit=commit)


def find_service_name_in_text(text: str | None, db=None):
    _bind_legacy_overrides()
    return _FIND_SERVICE_NAME_IN_TEXT(text, db=db)


def resolve_service_by_name(db, service_name: str | None):
    _bind_legacy_overrides()
    return _RESOLVE_SERVICE_BY_NAME(db, service_name)


def resolve_catalog_service(db, service_name: str | None):
    _bind_legacy_overrides()
    return _RESOLVE_CATALOG_SERVICE(db, service_name)
