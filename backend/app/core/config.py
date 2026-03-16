from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "Road700 Fleet Repairs"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    postgres_db: str = "road700"
    postgres_user: str = "road700"
    postgres_password: str = "road700"
    postgres_port: int = 5432
    cors_origins: list[str] = ["http://localhost:5173"]
    s3_bucket: str = "road700-documents"
    s3_region: str = "us-east-1"
    s3_endpoint: str = "http://minio:9000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@postgres:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

