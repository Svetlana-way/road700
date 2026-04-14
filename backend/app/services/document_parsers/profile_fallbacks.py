from __future__ import annotations


def apply_profile_specific_item_fallbacks(
    text: str,
    *,
    profile_scope: str | None,
    extracted_items: dict[str, list[dict[str, object]]],
    extracted_fields: dict[str, object],
    normalization_notes: list[str],
) -> dict[str, list[dict[str, object]]]:
    from app.application.documents.profile_fallbacks import (
        apply_profile_specific_item_fallbacks as _apply_profile_specific_item_fallbacks,
    )

    return _apply_profile_specific_item_fallbacks(
        text,
        profile_scope=profile_scope,
        extracted_items=extracted_items,
        extracted_fields=extracted_fields,
        normalization_notes=normalization_notes,
    )


def apply_profile_specific_total_fallbacks(
    text: str,
    *,
    profile_scope: str | None,
    extracted_fields: dict[str, object],
    confidence_map: dict[str, float],
    normalization_notes: list[str],
) -> None:
    from app.application.documents.profile_fallbacks import (
        apply_profile_specific_total_fallbacks as _apply_profile_specific_total_fallbacks,
    )

    _apply_profile_specific_total_fallbacks(
        text,
        profile_scope=profile_scope,
        extracted_fields=extracted_fields,
        confidence_map=confidence_map,
        normalization_notes=normalization_notes,
    )
