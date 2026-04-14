from __future__ import annotations

import argparse
from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from app.db.session import SessionLocal
from app.models.document import Document
from app.models.enums import DocumentStatus, RepairStatus, ServiceStatus, VehicleStatus
from app.models.repair import Repair
from app.models.service import Service
from app.models.vehicle import Vehicle
from app.services.document_metadata import derive_service_name_from_source_path, extract_document_source_path
from app.services.document_repair_relations import is_document_primary_eligible, order_repair_documents_by_source_priority
from app.services.service_catalog import ensure_service_catalog_synced, resolve_catalog_service


@dataclass
class SyncStats:
    services_synced: int = 0
    repairs_updated: int = 0
    repairs_skipped: int = 0


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Sync service catalog from folder and backfill repairs")
    parser.add_argument(
        "--skip-repair-backfill",
        action="store_true",
        help="Only sync services, do not update repairs",
    )
    return parser


def load_repair_documents(db, repair: Repair) -> list[Document]:
    return [
        document
        for document in order_repair_documents_by_source_priority(repair)
        if document.status != DocumentStatus.ARCHIVED and is_document_primary_eligible(document)
    ]


def sync_service_catalog(*, skip_repair_backfill: bool = False) -> SyncStats:
    stats = SyncStats()
    with SessionLocal() as db:
        stats.services_synced = len(ensure_service_catalog_synced(db, commit=True))
        if skip_repair_backfill:
            return stats

        repairs = db.scalars(
            select(Repair)
            .join(Vehicle, Vehicle.id == Repair.vehicle_id)
            .outerjoin(Service, Service.id == Repair.service_id)
            .options(joinedload(Repair.documents).joinedload(Document.versions))
            .where(
                Repair.status != RepairStatus.ARCHIVED,
                Vehicle.status != VehicleStatus.ARCHIVED,
                or_(Repair.service_id.is_(None), Service.status != ServiceStatus.ARCHIVED),
            )
            .order_by(Repair.id.asc())
        ).unique().all()

        for repair in repairs:
            matched_service = None
            for document in load_repair_documents(db, repair):
                source_path = extract_document_source_path(document)
                service_hint = derive_service_name_from_source_path(source_path)
                if not service_hint:
                    continue
                matched_service = resolve_catalog_service(db, service_hint)
                if matched_service is not None:
                    break

            if matched_service is None:
                stats.repairs_skipped += 1
                continue

            if repair.service_id == matched_service.id:
                stats.repairs_skipped += 1
                continue

            repair.service_id = matched_service.id
            db.add(repair)
            stats.repairs_updated += 1

        db.commit()
    return stats


def main() -> None:
    parser = build_argument_parser()
    args = parser.parse_args()
    stats = sync_service_catalog(skip_repair_backfill=args.skip_repair_backfill)
    print(
        "Service catalog synced:",
        {
            "services_synced": stats.services_synced,
            "repairs_updated": stats.repairs_updated,
            "repairs_skipped": stats.repairs_skipped,
        },
    )


if __name__ == "__main__":
    main()
