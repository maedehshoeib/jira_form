from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.models.user import User
from app.services.jira_service import jira_service
from app.services.portal_service import DEPARTMENTS, FORM_TEMPLATES

router = APIRouter()


@router.get("/me")
async def jira_me(current_user: User = Depends(get_current_user)):
    data = await jira_service.get_me(current_user.username)
    return data


@router.get("/users")
async def jira_users(current_user: User = Depends(get_current_user)):
    users = await jira_service.get_users(current_user.username)
    if users:
        return users
    return [
        {
            "username": current_user.username,
            "displayName": current_user.display_name,
            "email": current_user.email,
        }
    ]


@router.get("/request-types")
async def jira_request_types(current_user: User = Depends(get_current_user)):
    types = await jira_service.get_request_types(current_user.username)
    if types:
        return types

    return [
        {
            "name": form.title,
            "fields": [{"id": f.name, "name": f.label} for f in form.fields],
        }
        for form in FORM_TEMPLATES.values()
    ]
