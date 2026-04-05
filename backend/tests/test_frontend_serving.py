from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.paths import get_frontend_dist_dir, set_frontend_dist_dir
from app.main import app


class FrontendServingTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.original_frontend_dist_dir = get_frontend_dist_dir()
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.frontend_dist_dir = Path(cls.temp_dir.name) / "dist"
        cls.frontend_dist_dir.mkdir(parents=True, exist_ok=True)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        set_frontend_dist_dir(cls.original_frontend_dist_dir)
        cls.temp_dir.cleanup()

    def setUp(self) -> None:
        set_frontend_dist_dir(self.frontend_dist_dir)
        for path in sorted(self.frontend_dist_dir.rglob("*"), reverse=True):
            if path.is_file():
                path.unlink()
            elif path.is_dir():
                path.rmdir()
        self.frontend_dist_dir.mkdir(parents=True, exist_ok=True)

    def test_root_serves_runtime_frontend_index_override(self) -> None:
        index_file = self.frontend_dist_dir / "index.html"
        index_file.write_text("<html><body>runtime frontend</body></html>", encoding="utf-8")

        response = self.client.get("/")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn("runtime frontend", response.text)

    def test_nested_route_falls_back_to_runtime_frontend_index(self) -> None:
        index_file = self.frontend_dist_dir / "index.html"
        index_file.write_text("<html><body>spa shell</body></html>", encoding="utf-8")

        response = self.client.get("/repairs/42")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn("spa shell", response.text)

    def test_static_asset_is_served_from_runtime_frontend_dist_override(self) -> None:
        index_file = self.frontend_dist_dir / "index.html"
        asset_file = self.frontend_dist_dir / "assets" / "app.js"
        index_file.write_text("<html><body>index</body></html>", encoding="utf-8")
        asset_file.parent.mkdir(parents=True, exist_ok=True)
        asset_file.write_text("console.log('runtime asset');", encoding="utf-8")

        response = self.client.get("/assets/app.js")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn("runtime asset", response.text)

    def test_missing_static_asset_returns_404_instead_of_spa_shell(self) -> None:
        index_file = self.frontend_dist_dir / "index.html"
        index_file.write_text("<html><body>spa shell</body></html>", encoding="utf-8")

        response = self.client.get("/assets/missing.js")

        self.assertEqual(response.status_code, 404, response.text)
        self.assertEqual(response.json()["detail"], "Not Found")

    def test_missing_frontend_build_returns_503(self) -> None:
        response = self.client.get("/")

        self.assertEqual(response.status_code, 503, response.text)
        self.assertEqual(response.json()["detail"], "Frontend build not found")
