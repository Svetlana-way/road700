from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.labor_norm_catalog import LaborNormCatalog
from app.models.labor_norm import LaborNorm
from app.core.paths import resolve_user_path
from app.scripts.import_labor_norms import import_labor_norms_with_session
from app.services.labor_norms import upsert_labor_norm_catalog
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class ImportLaborNormsTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_sqlite_test_engine(enforce_foreign_keys=True)
        cls.SessionLocal = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()

    def setUp(self) -> None:
        reset_database(self.engine, Base.metadata)

    def test_import_keeps_auto_match_enabled_for_existing_non_default_catalog(self) -> None:
        csv_content = "\n".join(
            [
                "code,category,source_sheet,name_ru,name_ru_alt,name_cn,name_en,standard_hours",
                "VOLVOFH_LIGHT_TAILLAMP,7. Освещение,7. Освещение,Замена заднего фонаря,,,,0.60",
            ]
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "volvo.csv"
            csv_path.write_text(csv_content, encoding="utf-8")

            with self.SessionLocal() as db:
                upsert_labor_norm_catalog(
                    db,
                    scope="volvo_fh_approx_vstg_2026",
                    catalog_name="Volvo FH Approx VSTG 2026",
                    brand_family="volvo",
                    auto_match_enabled=True,
                )
                db.commit()

            with self.SessionLocal() as db:
                stats = import_labor_norms_with_session(
                    db,
                    path=csv_path,
                    scope="volvo_fh_approx_vstg_2026",
                    brand_family="volvo",
                    catalog_name="Volvo FH Approx VSTG 2026",
                )
                self.assertEqual(stats.created, 1)
                self.assertEqual(stats.updated, 0)
                self.assertEqual(stats.skipped, 0)

            with self.SessionLocal() as db:
                catalog = db.scalar(
                    select(LaborNormCatalog).where(LaborNormCatalog.scope == "volvo_fh_approx_vstg_2026")
                )
                self.assertIsNotNone(catalog)
                self.assertTrue(catalog.auto_match_enabled)

    def test_default_dongfeng_import_applies_override_aliases(self) -> None:
        with self.SessionLocal() as db:
            stats = import_labor_norms_with_session(db)
            self.assertGreater(stats.updated, 0)

            norm = db.scalar(select(LaborNorm).where(LaborNorm.scope == "dongfeng_2025", LaborNorm.code == "11170102"))

        self.assertIsNotNone(norm)
        self.assertIn("тонкой очистки", norm.name_ru_alt or "")

    def test_overlay_paths_use_resolved_backend_data_root(self) -> None:
        base_csv_content = "\n".join(
            [
                "code,category,source_sheet,name_ru,name_ru_alt,name_cn,name_en,standard_hours",
                "11170102,Система питания,Система питания,Замена фильтра,,,,0.80",
            ]
        )
        overlay_csv_content = "\n".join(
            [
                "code,category,source_sheet,name_ru,name_ru_alt,name_cn,name_en,standard_hours",
                "11170102,Система питания,Система питания,Замена фильтра,Фильтра тонкой очистки топлива,,,0.80",
            ]
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            catalog_path = temp_root / "dongfeng.csv"
            catalog_path.write_text(base_csv_content, encoding="utf-8")

            data_root = temp_root / "container-data"
            overlay_dir = data_root / "labor_norms"
            overlay_dir.mkdir(parents=True)
            (overlay_dir / "dongfeng_2025_overrides.csv").write_text(overlay_csv_content, encoding="utf-8")

            with patch("app.scripts.import_labor_norms.get_backend_data_root", return_value=data_root):
                with self.SessionLocal() as db:
                    stats = import_labor_norms_with_session(db, path=catalog_path)
                    self.assertEqual(stats.created, 1)
                    self.assertEqual(stats.updated, 1)
                    self.assertEqual(stats.skipped, 0)

                    norm = db.scalar(
                        select(LaborNorm).where(LaborNorm.scope == "dongfeng_2025", LaborNorm.code == "11170102")
                    )

        self.assertIsNotNone(norm)
        self.assertIn("тонкой очистки", norm.name_ru_alt or "")

    def test_resolve_user_path_expands_home_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            home_dir = Path(temp_dir)
            catalog_path = home_dir / "catalog.csv"
            catalog_path.write_text("code,name_ru,standard_hours\nA,Test,1\n", encoding="utf-8")

            with patch.dict(os.environ, {"HOME": str(home_dir)}):
                resolved = resolve_user_path("~/catalog.csv")

        self.assertEqual(resolved, catalog_path.resolve())


if __name__ == "__main__":
    unittest.main()
