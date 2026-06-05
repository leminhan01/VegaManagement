"""VegiFlow Chatbot Service — Configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_MODEL_ADVANCED: str = "gpt-4o"

    # NestJS Backend (internal API)
    BACKEND_API_URL: str = "http://localhost:3000/api/bot"
    BOT_API_KEY: str = ""

    # Zalo OA
    ZALO_OA_ID: str = ""
    ZALO_OA_ACCESS_TOKEN: str = ""
    ZALO_WEBHOOK_VERIFY_TOKEN: str = ""

    # Facebook Messenger
    FB_PAGE_ID: str = ""
    FB_PAGE_ACCESS_TOKEN: str = ""
    FB_APP_SECRET: str = ""
    FB_WEBHOOK_VERIFY_TOKEN: str = ""

    # Session
    SESSION_TTL_HOURS: int = 24

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
