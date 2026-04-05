from functools import lru_cache
from typing import Annotated, Optional
from urllib.parse import urlsplit

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "Road700 Fleet Repairs"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    max_document_upload_size_bytes: int = 25 * 1024 * 1024
    max_import_upload_size_bytes: int = 20 * 1024 * 1024
    database_url_override: Optional[str] = Field(default=None, validation_alias="DATABASE_URL")
    postgres_db: str = "road700"
    postgres_user: str = "road700"
    postgres_password: str = "road700"
    postgres_port: int = 5432
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"],
        validation_alias="BACKEND_CORS_ORIGINS",
    )
    public_base_url: Optional[str] = None
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120
    auth_login_rate_limit_window_seconds: int = 600
    auth_login_rate_limit_max_per_ip: int = 20
    auth_login_rate_limit_max_per_login: int = 5
    auth_password_reset_rate_limit_window_seconds: int = 900
    auth_password_reset_rate_limit_max_per_ip: int = 10
    auth_password_reset_rate_limit_max_per_email: int = 3
    password_reset_token_ttl_minutes: int = 60
    initial_admin_full_name: str = "System Administrator"
    initial_admin_login: str = "admin"
    initial_admin_email: str = "admin@example.com"
    initial_admin_password: str = "change-me"
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: str = "Road700"
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    require_full_ocr_runtime: bool = False

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if value is None:
            return ["http://localhost:5173"]
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("public_base_url", mode="before")
    @classmethod
    def normalize_public_base_url(cls, value: object) -> object:
        if value is None:
            return None
        if not isinstance(value, str):
            return value

        normalized = value.strip().rstrip("/")
        if not normalized:
            return None

        parsed = urlsplit(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("PUBLIC_BASE_URL must be a full http(s) URL")

        return normalized

    @model_validator(mode="after")
    def validate_smtp_settings(self) -> "Settings":
        if self.smtp_use_tls and self.smtp_use_ssl:
            raise ValueError("SMTP_USE_TLS and SMTP_USE_SSL cannot both be enabled")
        if bool(self.smtp_username) != bool(self.smtp_password):
            raise ValueError("SMTP_USERNAME and SMTP_PASSWORD must be set together")
        return self

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@postgres:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
