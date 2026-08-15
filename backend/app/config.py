from functools import lru_cache
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""
    groq_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    groq_model: str = "llama-3.1-8b-instant"
    youtube_api_key: str = ""

    database_url: str = Field(
        default="postgresql://atlas:atlas@localhost:5432/atlas_v3",
    )

    admin_username: str = "admin"
    admin_password: str = "changeme"
    viewer_username: str = "viewer"
    viewer_password: str = ""
    jwt_secret: str = "change-this-jwt-secret-for-vr"
    jwt_expire_hours: int = 12
    atlas_api_key: str = ""

    max_videos_per_run: int = 50
    max_concurrent_runs: int = 1
    max_runs_per_hour: int = 4
    rate_limit_per_minute: int = 30
    run_time_budget_seconds: int = 720
    enable_embeddings: bool = True
    enable_inline_worker: bool = True
    youtube_daily_unit_budget: int = 8000  # soft stop under default 10k
    youtube_search_units: int = 100
    youtube_videos_units: int = 1

    app_env: str = "production"
    app_version: str = "3.0.27"
    log_level: str = "INFO"
    cors_origins: str = "*"
    public_base_url: str = ""
    prompt_version: str = "v3_v1"
    analysis_version: str = "stats_v1"
    slo_quick_run_seconds: int = 900

    @property
    def cors_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

@lru_cache
def get_settings() -> Settings:
    return Settings()
