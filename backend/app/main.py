from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes.auth import router as auth_router
from app.api.routes.admin import router as admin_router
from app.api.routes.contracts import router as contracts_router
from app.api.routes.jira import router as jira_router
from app.api.routes.portal import router as portal_router
from app.api.routes.reports import router as reports_router
from app.api.routes.timesheet import router as timesheet_router
from app.core.cors import add_cors
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="سامانه جامع خدمات", lifespan=lifespan)

add_cors(app)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(portal_router, prefix="/api/v1", tags=["portal"])
app.include_router(reports_router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(contracts_router, prefix="/api/v1/contracts", tags=["contracts"])
app.include_router(jira_router, prefix="/api/v1/jira", tags=["jira"])
app.include_router(timesheet_router, prefix="/api/v1/timesheet", tags=["timesheet"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"

if (FRONTEND_DIST / "assets").exists():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST / "assets"),
        name="assets",
    )

favicon = FRONTEND_DIST / "favicon.ico"
if favicon.exists():

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon_icon():
        return FileResponse(favicon)


if FRONTEND_INDEX.exists():

    @app.get("/{full_path:path}", include_in_schema=False)
    async def react_app(full_path: str):
        requested = FRONTEND_DIST / full_path

        if requested.exists() and requested.is_file():
            return FileResponse(requested)

        return FileResponse(FRONTEND_INDEX)
