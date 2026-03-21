from functools import lru_cache
from typing import Annotated, Optional

from pydantic import Field, field_validator
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
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120
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
    s3_bucket: str = "road700-documents"
    s3_region: str = "us-east-1"
    s3_endpoint: str = "http://minio:9000"
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
