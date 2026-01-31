"""
Configuration management for InsightFlow AI backend.
Uses Pydantic for validated, type-safe settings.
"""
import os
from typing import List
from pydantic import BaseModel, Field, field_validator
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))


class Settings(BaseModel):
    """Application settings with validation."""
    
    # API Keys
    gemini_api_key: str = Field(..., env='GEMINI_API_KEY')
    google_api_key: str = Field(default="", env='GOOGLE_API_KEY')
    
    # CORS
    allowed_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        env='ALLOWED_ORIGINS'
    )
    
    # File Upload
    max_file_size_mb: int = Field(default=1000, env='MAX_FILE_SIZE_MB')
    allowed_file_types: List[str] = Field(
        default=[".csv", ".json"],
        env='ALLOWED_FILE_TYPES'
    )
    
    # Storage
    data_store_path: str = Field(default="./data_store", env='DATA_STORE_PATH')
    session_ttl_hours: int = Field(default=24, env='SESSION_TTL_HOURS')
    
    # LLM
    llm_model: str = Field(default="gemini-2.5-flash-lite", env='LLM_MODEL')
    llm_temperature: float = Field(default=0.1, env='LLM_TEMPERATURE')
    llm_timeout_seconds: int = Field(default=30, env='LLM_TIMEOUT_SECONDS')
    
    # Code Execution
    code_exec_timeout_seconds: int = Field(default=5, env='CODE_EXEC_TIMEOUT_SECONDS')
    max_code_length: int = Field(default=10000, env='MAX_CODE_LENGTH')
    
    # Logging
    log_level: str = Field(default="INFO", env='LOG_LEVEL')
    log_file: str = Field(default="app.log", env='LOG_FILE')
    log_max_bytes: int = Field(default=10_000_000, env='LOG_MAX_BYTES')
    log_backup_count: int = Field(default=5, env='LOG_BACKUP_COUNT')
    
    # Server
    host: str = Field(default="0.0.0.0", env='HOST')
    port: int = Field(default=8000, env='PORT')
    
    # Cache
    enable_cache: bool = Field(default=True, env='ENABLE_CACHE')
    cache_ttl_seconds: int = Field(default=3600, env='CACHE_TTL_SECONDS')
    
    @field_validator('allowed_origins', mode='before')
    @classmethod
    def parse_allowed_origins(cls, v):
        """Parse comma-separated origins from env var."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    @field_validator('allowed_file_types', mode='before')
    @classmethod
    def parse_allowed_file_types(cls, v):
        """Parse comma-separated file types from env var."""
        if isinstance(v, str):
            return [ft.strip() for ft in v.split(',')]
        return v
    
    @property
    def api_key(self) -> str:
        """Get API key from either GEMINI_API_KEY or GOOGLE_API_KEY."""
        return self.gemini_api_key or self.google_api_key
    
    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024
    
    class Config:
        env_file = '.env'
        case_sensitive = False


def get_settings() -> Settings:
    """Get application settings singleton."""
    try:
        # Check if environment variables are set, fallback to empty string if not
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "DUMMY_KEY"
        return Settings(
            gemini_api_key=gemini_key
        )
    except Exception as e:
        print(f"Error loading settings: {e}")
        # Return a partial settings object if possible, or re-raise
        raise RuntimeError(f"Failed to load application settings: {e}. Please check your .env file.")


# Global settings instance
settings = get_settings()
