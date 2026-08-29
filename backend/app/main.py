from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.cors import add_cors
from app.core.config import settings
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="سامانه جامع خدمات", lifespan=lifespan)

add_cors(app)

app.include_router(api_router, prefix="/api/v1")

AVATAR_DIR = (Path(settings.UPLOAD_DIR) / "avatars").resolve()
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/api/v1/avatars", StaticFiles(directory=AVATAR_DIR), name="avatars")
