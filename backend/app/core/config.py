"""
Application Configuration
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"  # Ignore extra env vars not defined in Settings
    )
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

    # AWS Core
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")

    # AWS RDS Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    DB_HOST: str = os.getenv("DB_HOST", "")
    DB_PORT: str = os.getenv("DB_PORT", "5432")
    DB_NAME: str = os.getenv("DB_NAME", "secondwatchnetwork")
    DB_USER: str = os.getenv("DB_USER", "")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")

    # AWS S3 Storage
    AWS_S3_BUCKET: str = os.getenv("AWS_S3_BUCKET", "")
    AWS_S3_AVATARS_BUCKET: str = os.getenv("AWS_S3_AVATARS_BUCKET", "")
    AWS_S3_BACKLOT_BUCKET: str = os.getenv("AWS_S3_BACKLOT_BUCKET", "")
    AWS_S3_BACKLOT_FILES_BUCKET: str = os.getenv("AWS_S3_BACKLOT_FILES_BUCKET", "")

    # AWS Cognito Authentication
    COGNITO_USER_POOL_ID: str = os.getenv("COGNITO_USER_POOL_ID", "")
    COGNITO_CLIENT_ID: str = os.getenv("COGNITO_CLIENT_ID", "")
    COGNITO_CLIENT_SECRET: str = os.getenv("COGNITO_CLIENT_SECRET", "")
    COGNITO_REGION: str = os.getenv("COGNITO_REGION", "us-east-1")

    # Feature Flags
    USE_AWS: bool = os.getenv("USE_AWS", "true").lower() == "true"

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

    # Stripe Billing
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY: str = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_PREMIUM_PRICE_ID: str = os.getenv("STRIPE_PREMIUM_PRICE_ID", "")
    STRIPE_PREMIUM_YEARLY_PRICE_ID: str = os.getenv("STRIPE_PREMIUM_YEARLY_PRICE_ID", "")
    STRIPE_BACKLOT_MONTHLY_PRICE_ID: str = os.getenv("STRIPE_BACKLOT_MONTHLY_PRICE_ID", "")
    STRIPE_BACKLOT_YEARLY_PRICE_ID: str = os.getenv("STRIPE_BACKLOT_YEARLY_PRICE_ID", "")

    # WebSocket Configuration (AWS API Gateway WebSocket)
    WEBSOCKET_API_ENDPOINT: str = os.getenv("WEBSOCKET_API_ENDPOINT", "")
    WEBSOCKET_CONNECTIONS_TABLE: str = os.getenv("WEBSOCKET_CONNECTIONS_TABLE", "second-watch-websocket-connections")


settings = Settings()
