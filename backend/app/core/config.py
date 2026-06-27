from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "سامانه جامع خدمات"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"
    DATABASE_URL: str = "sqlite:///./portal.db"

    class Config:
        env_file = ".env"

settings = Settings()