from __future__ import annotations

import tempfile
import unittest
import warnings
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.exc import SAWarning
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.labor_norm_catalog import LaborNormCatalog
from app.scripts.import_labor_norms import import_labor_norms_with_session
from app.services.labor_norms import upsert_labor_norm_catalog


class ImportLaborNormsTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )
        cls.SessionLocal = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()

    def setUp(self) -> None:
        with self.engine.begin() as connection:
            with warnings.catch_warnings():
                warnings.filterwarnings(
                    "ignore",
                    message="Cannot correctly sort tables; there are unresolvable cycles between tables",
                    category=SAWarning,
                )
                tables = list(reversed(Base.metadata.sorted_tables))
            for table in tables:
                connection.execute(table.delete())

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


if __name__ == "__main__":
    unittest.main()
