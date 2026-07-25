from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "سامانه جامع خدمات"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://localhost:8000"
    DATABASE_URL: str = "sqlite:///./data/portal.db"
    CONTRACTS_DATABASE_URL: str = "sqlite:///./data/contracts.db"

    # JWT
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Local employee accounts
    USERS_SEED_ENABLED: bool = True
    USERS_SEED_FILE: str = "../users.xlsx"
    DEFAULT_USER_PASSWORD: str = "Secure@1234567"
    ADMIN_USERNAME: str = "Vosouq.admin"
    ADMIN_PASSWORD: str = "Jethro@2003"
    ADMIN_MAX_DEVICES: int = 4

    # Jira ScriptRunner APIs
    JIRA_BASE_URL: str = "https://jira.vosouq.me"
    JIRA_ENABLED: bool = True
    JIRA_USERNAME: str = ""
    JIRA_PASSWORD: str = ""
    JIRA_TIMEOUT: int = 30

    # External API key for Jira admin to fetch reports
    REPORTS_API_KEY: str = "jira-admin-reports-key"

    # File uploads
    UPLOAD_DIR: str = "./data/uploads"
    CONTRACTS_UPLOAD_DIR: str = "./data/contracts_uploads"

    class Config:
        env_file = ".env"


settings = Settings()
