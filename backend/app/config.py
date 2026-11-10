from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./data/network.db"
    snmp_community: str = "public"
    cors_origins: str = "http://localhost:3000"
    app_name: str = "InfraView"
    app_version: str = "1.2.0"
    ping_enabled: bool = True
    ping_timeout_sec: int = 1
    scan_subnet: str | None = None

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
