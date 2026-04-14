from __future__ import annotations

from typing import Optional


def extract_antares_items(text: str) -> dict[str, list[dict[str, object]]]:
    from app.application.documents.document_parsers.antares import extract_antares_items as _extract_antares_items

    return _extract_antares_items(text)


def extract_axb_invoice_items(text: str) -> dict[str, list[dict[str, object]]]:
    from app.application.documents.document_parsers.axb_invoice_items import (
        extract_axb_invoice_items as _extract_axb_invoice_items,
    )

    return _extract_axb_invoice_items(text)


def extract_axb_material_parts(text: str, *, expected_parts_total: Optional[float] = None) -> list[dict[str, object]]:
    from app.application.documents.document_parsers.axb_materials import (
        extract_axb_material_parts as _extract_axb_material_parts,
    )

    return _extract_axb_material_parts(text, expected_parts_total=expected_parts_total)


def extract_axb_work_items(text: str, *, expected_work_total: Optional[float] = None) -> list[dict[str, object]]:
    from app.application.documents.document_parsers.axb_work_items import (
        extract_axb_work_items as _extract_axb_work_items,
    )

    return _extract_axb_work_items(text, expected_work_total=expected_work_total)


def extract_ets_act_items(text: str) -> dict[str, list[dict[str, object]]]:
    from app.application.documents.document_parsers.ets_act_support import (
        extract_ets_act_items as _extract_ets_act_items,
    )

    return _extract_ets_act_items(text)


def extract_gruzovye_rezervy_items(text: str) -> dict[str, list[dict[str, object]]]:
    from app.application.documents.document_parsers.gruzovye_rezervy import (
        extract_gruzovye_rezervy_items as _extract_gruzovye_rezervy_items,
    )

    return _extract_gruzovye_rezervy_items(text)


def extract_klever_trak_items(text: str) -> dict[str, list[dict[str, object]]]:
    from app.application.documents.document_parsers.klever_trak import (
        extract_klever_trak_items as _extract_klever_trak_items,
    )

    return _extract_klever_trak_items(text)


def extract_leader_trak_items(text: str) -> dict[str, list[dict[str, object]]]:
    from app.application.documents.document_parsers.leader_trak import (
        extract_leader_trak_items as _extract_leader_trak_items,
    )

    return _extract_leader_trak_items(text)


def extract_logistics_items(text: str) -> dict[str, list[dict[str, object]]]:
    from app.application.documents.document_parsers.logistics import (
        extract_logistics_items as _extract_logistics_items,
    )

    return _extract_logistics_items(text)


def extract_sibtrakscan_items(text: str) -> dict[str, list[dict[str, object]]]:
    from app.application.documents.document_parsers.sibtrakscan import (
        extract_sibtrakscan_items as _extract_sibtrakscan_items,
    )

    return _extract_sibtrakscan_items(text)
