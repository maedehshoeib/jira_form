from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes.portal import router as portal_router
from app.core.cors import add_cors

app = FastAPI(title="سامانه جامع خدمات")

add_cors(app)

# ---------------- API ----------------

app.include_router(
    portal_router,
    prefix="/api/v1",
    tags=["portal"],
)

# ---------------- React ----------------

BASE_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

# فایل‌های assets
app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIST / "assets"),
    name="assets",
)

# favicon اگر وجود داشت
favicon = FRONTEND_DIST / "favicon.ico"
if favicon.exists():

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon_icon():
        return FileResponse(favicon)

# همه Routeهای React
@app.get("/{full_path:path}", include_in_schema=False)
async def react_app(full_path: str):

    requested = FRONTEND_DIST / full_path

    if requested.exists() and requested.is_file():
        return FileResponse(requested)

    return FileResponse(FRONTEND_DIST / "index.html")
