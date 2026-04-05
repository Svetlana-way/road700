from __future__ import annotations

import io
import unittest

from app.scripts.build_historical_reference_catalogs import parse_workbook


class BuildHistoricalReferenceCatalogsTestCase(unittest.TestCase):
    def test_parse_workbook_returns_value_error_for_unreadable_workbook(self) -> None:
        with self.assertRaisesRegex(ValueError, "Не удалось прочитать файл исторических справочников"):
            parse_workbook(io.BytesIO(b"not-a-workbook"))


if __name__ == "__main__":
    unittest.main()
