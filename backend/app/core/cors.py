from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

def add_cors(app):
    origins = [o.strip() for o in settings.BACKEND_CORS_ORIGINS.split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )