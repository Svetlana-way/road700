from __future__ import annotations

import unittest

from app.core.config import Settings


class SettingsConfigTestCase(unittest.TestCase):
    def test_public_base_url_is_normalized_and_trailing_slash_is_removed(self) -> None:
        settings = Settings(_env_file=None, public_base_url=" https://road700.example.com/ ")

        self.assertEqual(settings.public_base_url, "https://road700.example.com")

    def test_public_base_url_rejects_missing_scheme(self) -> None:
        with self.assertRaisesRegex(ValueError, "PUBLIC_BASE_URL must be a full http\\(s\\) URL"):
            Settings(_env_file=None, public_base_url="road700.example.com")

    def test_smtp_rejects_tls_and_ssl_enabled_together(self) -> None:
        with self.assertRaisesRegex(ValueError, "SMTP_USE_TLS and SMTP_USE_SSL cannot both be enabled"):
            Settings(_env_file=None, smtp_use_tls=True, smtp_use_ssl=True)

    def test_smtp_rejects_partial_credentials(self) -> None:
        with self.assertRaisesRegex(ValueError, "SMTP_USERNAME and SMTP_PASSWORD must be set together"):
            Settings(_env_file=None, smtp_username="mailer")


if __name__ == "__main__":
    unittest.main()
