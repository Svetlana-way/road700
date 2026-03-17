from __future__ import annotations

from pathlib import Path

from app.db.session import SessionLocal
from app.scripts.import_labor_norms import import_labor_norms_with_session


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SOURCE_PATH = PROJECT_ROOT / "backend" / "data" / "labor_norms" / "kamaz_legacy_starter.csv"


def main() -> None:
    with SessionLocal() as db:
        stats = import_labor_norms_with_session(
            db,
            path=DEFAULT_SOURCE_PATH,
            scope="kamaz_legacy",
            brand_family="kamaz",
            catalog_name="KamAZ 5320 Legacy Starter",
        )
    print(stats.as_dict())


if __name__ == "__main__":
    main()
