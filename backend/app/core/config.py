import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "RAG Document QA System"
    API_V1_STR: str = "/api/v1"
    
    # Security
    JWT_SECRET: str = "supersecretjwtkey12345!please_change_me_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # DB Connections
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/knowledge_hub"
    REDIS_URL: str = "redis://localhost:6379/0"
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    
    # RAG Settings
    UPLOAD_DIR: str = "storage/uploads"
    CHUNK_SIZE: int = 600
    CHUNK_OVERLAP: int = 100
    
    # LLM Settings
    # Supports: "gemini", "ollama", "openai", or "mock" (for testing)
    LLM_PROVIDER: str = "gemini"
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5"
    
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
