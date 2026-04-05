from __future__ import annotations

from pathlib import Path

from app.core.paths import get_backend_data_root
from app.db.session import SessionLocal
from app.scripts.import_labor_norms import import_labor_norms_with_session

def default_source_path() -> Path:
    return get_backend_data_root() / "labor_norms" / "kamaz_legacy_starter.csv"


def main() -> None:
    with SessionLocal() as db:
        stats = import_labor_norms_with_session(
            db,
            path=default_source_path(),
            scope="kamaz_legacy",
            brand_family="kamaz",
            catalog_name="KamAZ 5320 Legacy Starter",
        )
    print(stats.as_dict())


if __name__ == "__main__":
    main()
