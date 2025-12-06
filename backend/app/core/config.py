"""
Application Configuration
"""
from pydantic_settings import BaseSettings
from typing import List
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "Second Watch Network API"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "True") == "True"
    API_V1_PREFIX: str = "/api/v1"

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:8080",
        "*",  # Allow all origins in development
    ]

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # AWS
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_S3_BUCKET: str = os.getenv("AWS_S3_BUCKET", "")

    # Superadmin Configuration
    # The email address of the main superadmin user
    # This user will be automatically granted superadmin privileges on startup
    SUPERADMIN_EMAIL: str = os.getenv("SUPERADMIN_EMAIL", "")

    # AI Configuration (for Backlot Co-pilot)
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    AI_MODEL: str = os.getenv("AI_MODEL", "claude-sonnet-4-20250514")  # Default to Claude

    # Email Configuration (Resend, SendGrid, or SMTP)
    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "resend")  # resend, sendgrid, smtp
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    EMAIL_FROM_ADDRESS: str = os.getenv("EMAIL_FROM_ADDRESS", "noreply@secondwatch.network")
    EMAIL_FROM_NAME: str = os.getenv("EMAIL_FROM_NAME", "Second Watch Network")

    # Frontend URL (for email links)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:8080")

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
