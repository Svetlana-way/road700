from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.labor_norm_catalog import LaborNormCatalog
from app.models.labor_norm import LaborNorm
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


if __name__ == "__main__":
    unittest.main()
