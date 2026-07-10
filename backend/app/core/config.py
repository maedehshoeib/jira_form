from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "سامانه جامع خدمات"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://localhost:8000"
    DATABASE_URL: str = "sqlite:///./data/portal.db"

    # JWT
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # LDAP / Active Directory (organizational login)
    LDAP_ENABLED: bool = True
    LDAP_SERVER: str = "ldap://dc.vosouq.local"
    LDAP_PORT: int = 389
    LDAP_USE_SSL: bool = False
    LDAP_BASE_DN: str = "DC=vosouq,DC=local"
    LDAP_USER_DN_TEMPLATE: str = "{username}@vosouq.local"
    LDAP_BIND_DN: str = ""
    LDAP_BIND_PASSWORD: str = ""

    # Dev fallback when not on internal network
    DEV_AUTH_ENABLED: bool = True
    DEV_AUTH_USERNAME: str = "admin"
    DEV_AUTH_PASSWORD: str = "admin"

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

    class Config:
        env_file = ".env"


settings = Settings()
