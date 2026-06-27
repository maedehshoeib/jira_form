from fastapi import FastAPI
from app.api.routes.portal import router as portal_router
from app.core.cors import add_cors

app = FastAPI(title="سامانه جامع خدمات")
add_cors(app)
app.include_router(portal_router, prefix="/api/v1", tags=["portal"])

@app.get("/")
def root():
    return {"message": "سامانه جامع خدمات API is running"}