"""Single composition root for the versioned HTTP API."""

from fastapi import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.calendar import router as calendar_router
from app.api.routes.chat import router as chat_router
from app.api.routes.contracts import router as contracts_router
from app.api.routes.jira import router as jira_router
from app.api.routes.management_letters import router as management_letters_router
from app.api.routes.portal import router as portal_router
from app.api.routes.reports import router as reports_router
from app.api.routes.timesheet import router as timesheet_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(calendar_router, prefix="/calendar", tags=["calendar"])
api_router.include_router(portal_router, tags=["portal"])
api_router.include_router(management_letters_router, tags=["management-letters"])
api_router.include_router(reports_router, prefix="/reports", tags=["reports"])
api_router.include_router(contracts_router, prefix="/contracts", tags=["contracts"])
api_router.include_router(jira_router, prefix="/jira", tags=["jira"])
api_router.include_router(timesheet_router, prefix="/timesheet", tags=["timesheet"])
