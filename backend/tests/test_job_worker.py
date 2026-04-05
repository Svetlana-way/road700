from __future__ import annotations

from contextlib import nullcontext
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

from app.scripts import run_job_worker


class JobWorkerTestCase(unittest.TestCase):
    def test_process_single_job_returns_false_when_queue_is_empty(self) -> None:
        first_db = object()

        with (
            patch.object(run_job_worker, "SessionLocal", side_effect=[nullcontext(first_db)]),
            patch.object(run_job_worker, "claim_next_document_processing_job", return_value=None) as claim_job,
        ):
            processed = run_job_worker.process_single_job()

        self.assertFalse(processed)
        claim_job.assert_called_once_with(first_db)

    def test_process_single_job_processes_claimed_job(self) -> None:
        claimed_job = SimpleNamespace(id=17, document_id=33)
        attached_job = SimpleNamespace(id=17, document_id=33)
        first_db = object()
        second_db = MagicMock()
        second_db.get.return_value = attached_job

        with (
            patch.object(run_job_worker, "SessionLocal", side_effect=[nullcontext(first_db), nullcontext(second_db)]),
            patch.object(run_job_worker, "claim_next_document_processing_job", return_value=claimed_job) as claim_job,
            patch.object(run_job_worker, "run_document_processing_job") as run_job,
        ):
            processed = run_job_worker.process_single_job()

        self.assertTrue(processed)
        claim_job.assert_called_once_with(first_db)
        second_db.get.assert_called_once_with(run_job_worker.ImportJob, claimed_job.id)
        run_job.assert_called_once_with(second_db, attached_job)

    def test_process_single_job_returns_false_when_processing_raises(self) -> None:
        claimed_job = SimpleNamespace(id=18, document_id=44)
        attached_job = SimpleNamespace(id=18, document_id=44)
        first_db = object()
        second_db = MagicMock()
        second_db.get.return_value = attached_job

        with (
            patch.object(run_job_worker, "SessionLocal", side_effect=[nullcontext(first_db), nullcontext(second_db)]),
            patch.object(run_job_worker, "claim_next_document_processing_job", return_value=claimed_job),
            patch.object(run_job_worker, "run_document_processing_job", side_effect=RuntimeError("ocr failed")),
            patch.object(run_job_worker.logger, "exception") as log_exception,
        ):
            processed = run_job_worker.process_single_job()

        self.assertFalse(processed)
        log_exception.assert_called_once()

    def test_process_single_job_returns_false_when_claimed_job_is_missing_on_reload(self) -> None:
        claimed_job = SimpleNamespace(id=19, document_id=55)
        first_db = object()
        second_db = MagicMock()
        second_db.get.return_value = None

        with (
            patch.object(run_job_worker, "SessionLocal", side_effect=[nullcontext(first_db), nullcontext(second_db)]),
            patch.object(run_job_worker, "claim_next_document_processing_job", return_value=claimed_job),
            patch.object(run_job_worker.logger, "warning") as log_warning,
        ):
            processed = run_job_worker.process_single_job()

        self.assertFalse(processed)
        log_warning.assert_called_once()

    def test_main_once_runs_single_iteration_without_sleep(self) -> None:
        args = SimpleNamespace(once=True, poll_interval=0.1)
        parser = MagicMock()
        parser.parse_args.return_value = args

        with (
            patch.object(run_job_worker, "build_argument_parser", return_value=parser),
            patch.object(run_job_worker, "format_ocr_runtime_status_lines", return_value=[]),
            patch.object(run_job_worker, "process_single_job", return_value=False) as process_single_job,
            patch.object(run_job_worker, "ensure_ocr_runtime") as ensure_ocr_runtime,
            patch.object(run_job_worker.settings, "require_full_ocr_runtime", False),
            patch.object(run_job_worker.time, "sleep") as sleep_mock,
        ):
            run_job_worker.main()

        process_single_job.assert_called_once_with()
        ensure_ocr_runtime.assert_not_called()
        sleep_mock.assert_not_called()

    def test_main_requires_ocr_runtime_when_enabled(self) -> None:
        args = SimpleNamespace(once=True, poll_interval=2.0)
        parser = MagicMock()
        parser.parse_args.return_value = args

        with (
            patch.object(run_job_worker, "build_argument_parser", return_value=parser),
            patch.object(run_job_worker, "format_ocr_runtime_status_lines", return_value=["tesseract: ok"]),
            patch.object(run_job_worker, "process_single_job", return_value=False),
            patch.object(run_job_worker, "ensure_ocr_runtime") as ensure_ocr_runtime,
            patch.object(run_job_worker.settings, "require_full_ocr_runtime", True),
            patch.object(run_job_worker.logger, "info") as log_info,
        ):
            run_job_worker.main()

        ensure_ocr_runtime.assert_called_once_with()
        log_info.assert_any_call("job_worker_ocr_runtime %s", "tesseract: ok")

    def test_main_retries_after_unhandled_iteration_error(self) -> None:
        args = SimpleNamespace(once=False, poll_interval=0.1)
        parser = MagicMock()
        parser.parse_args.return_value = args

        with (
            patch.object(run_job_worker, "build_argument_parser", return_value=parser),
            patch.object(run_job_worker, "format_ocr_runtime_status_lines", return_value=[]),
            patch.object(run_job_worker, "process_single_job", side_effect=[RuntimeError("db unavailable"), KeyboardInterrupt()]),
            patch.object(run_job_worker.settings, "require_full_ocr_runtime", False),
            patch.object(run_job_worker.logger, "exception") as log_exception,
            patch.object(run_job_worker.time, "sleep") as sleep_mock,
        ):
            with self.assertRaises(KeyboardInterrupt):
                run_job_worker.main()

        log_exception.assert_called_once_with("job_worker_iteration_failed")
        sleep_mock.assert_called_once_with(0.2)

    def test_main_once_propagates_iteration_error(self) -> None:
        args = SimpleNamespace(once=True, poll_interval=1.0)
        parser = MagicMock()
        parser.parse_args.return_value = args

        with (
            patch.object(run_job_worker, "build_argument_parser", return_value=parser),
            patch.object(run_job_worker, "format_ocr_runtime_status_lines", return_value=[]),
            patch.object(run_job_worker, "process_single_job", side_effect=RuntimeError("queue unavailable")),
            patch.object(run_job_worker.settings, "require_full_ocr_runtime", False),
            patch.object(run_job_worker.logger, "exception") as log_exception,
            patch.object(run_job_worker.time, "sleep") as sleep_mock,
        ):
            with self.assertRaisesRegex(RuntimeError, "queue unavailable"):
                run_job_worker.main()

        log_exception.assert_called_once_with("job_worker_iteration_failed")
        sleep_mock.assert_not_called()
