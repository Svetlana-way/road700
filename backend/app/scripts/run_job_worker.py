from __future__ import annotations

import argparse
import logging
import time

from app.db.session import SessionLocal
from app.models.imports import ImportJob
from app.services.import_jobs import claim_next_document_processing_job, run_document_processing_job


logger = logging.getLogger(__name__)


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run queued document OCR jobs")
    parser.add_argument("--poll-interval", type=float, default=2.0, help="Seconds to wait when queue is empty")
    parser.add_argument("--once", action="store_true", help="Process at most one job and exit")
    return parser


def process_single_job() -> bool:
    with SessionLocal() as db:
        job = claim_next_document_processing_job(db)
        if job is None:
            return False

    logger.info("job_worker_claimed_job", extra={"job_id": job.id, "document_id": job.document_id})

    with SessionLocal() as db:
        attached_job = db.get(ImportJob, job.id)
        if attached_job is None:
            return False
        try:
            run_document_processing_job(db, attached_job)
            logger.info("job_worker_processed_job", extra={"job_id": attached_job.id, "document_id": attached_job.document_id})
        except Exception:
            logger.exception("job_worker_unhandled_error", extra={"job_id": attached_job.id, "document_id": attached_job.document_id})
            return False
    return True


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    parser = build_argument_parser()
    args = parser.parse_args()

    while True:
        processed = process_single_job()
        if args.once:
            return
        if not processed:
            time.sleep(max(args.poll_interval, 0.2))


if __name__ == "__main__":
    main()
