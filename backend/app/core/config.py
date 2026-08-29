from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "سامانه جامع خدمات"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://localhost:8000"
    DATABASE_URL: str = "postgresql+psycopg://portal:portal@localhost:5432/portal"
    CONTRACTS_DATABASE_URL: str = "postgresql+psycopg://portal:portal@localhost:5432/portal"
    SQLITE_MIGRATION_ENABLED: bool = True
    SQLITE_SOURCE_DATABASE_URL: str = "sqlite:///./data/portal.db"
    SQLITE_CONTRACTS_SOURCE_DATABASE_URL: str = "sqlite:///./data/contracts.db"

    # JWT
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Local employee accounts
    USERS_SEED_ENABLED: bool = True
    USERS_SEED_FILE: str = "../users.xlsx"
    DEFAULT_USER_PASSWORD: str = "change-me-before-production"
    ADMIN_USERNAME: str = "portal.admin"
    ADMIN_PASSWORD: str = "change-me-before-production"
    ADMIN_MAX_DEVICES: int = 4

    # Timesheet values are stored as the organization's local wall-clock time.
    # Never depend on the host/container timezone for active attendance checks.
    TIMESHEET_TIMEZONE: str = 'Asia/Tehran'
    TIMESHEET_DEMO_USERNAME: str = "ma.shoeib"

    # Jira ScriptRunner APIs
    JIRA_BASE_URL: str = "https://jira.vosouq.me"
    JIRA_ENABLED: bool = True
    JIRA_USERNAME: str = ""
    JIRA_PASSWORD: str = ""
    JIRA_TIMEOUT: int = 30

    # External API key for Jira admin to fetch reports
    REPORTS_API_KEY: str = "change-me-before-production"

    # File uploads
    UPLOAD_DIR: str = "./data/uploads"
    CONTRACTS_UPLOAD_DIR: str = "./data/contracts_uploads"

    class Config:
        env_file = ".env"


settings = Settings()
