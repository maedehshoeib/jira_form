from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes.auth import router as auth_router
from app.api.routes.admin import router as admin_router
from app.api.routes.chat import router as chat_router
from app.api.routes.calendar import router as calendar_router
from app.api.routes.contracts import router as contracts_router
from app.api.routes.jira import router as jira_router
from app.api.routes.management_letters import router as management_letters_router
from app.api.routes.portal import router as portal_router
from app.api.routes.reports import router as reports_router
from app.api.routes.timesheet import router as timesheet_router
from app.core.cors import add_cors
from app.core.config import settings
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="سامانه جامع خدمات", lifespan=lifespan)

add_cors(app)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(chat_router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(calendar_router, prefix="/api/v1/calendar", tags=["calendar"])
app.include_router(portal_router, prefix="/api/v1", tags=["portal"])
app.include_router(
    management_letters_router, prefix="/api/v1", tags=["management-letters"]
)
app.include_router(reports_router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(contracts_router, prefix="/api/v1/contracts", tags=["contracts"])
app.include_router(jira_router, prefix="/api/v1/jira", tags=["jira"])
app.include_router(timesheet_router, prefix="/api/v1/timesheet", tags=["timesheet"])

AVATAR_DIR = (Path(settings.UPLOAD_DIR) / "avatars").resolve()
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/api/v1/avatars", StaticFiles(directory=AVATAR_DIR), name="avatars")
