import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Path to backend directory containing .env
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI StudyMate API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    DATABASE_URL: str = "sqlite:///./studymate.db"

    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production-studymate-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours for dev convenience
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    LLM_PROVIDER: str = "gemini"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gemini-3.8-flash"
    LLM_TIMEOUT_SECONDS: int = 30
    EMBEDDING_PROVIDER: str = "local"
    EMBEDDING_API_KEY: str = ""
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384
    RETRIEVAL_TOP_K: int = 5
    RETRIEVAL_MAX_TOP_K: int = 20
    FILE_STORAGE: str = "local"
    UPLOAD_DIR: str = "uploads"
    CHUNK_SIZE_WORDS: int = 500
    CHUNK_OVERLAP_WORDS: int = 75

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
