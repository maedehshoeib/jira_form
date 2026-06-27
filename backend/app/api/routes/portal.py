from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from app.services.portal_service import DEPARTMENTS, FORM_TEMPLATES

router = APIRouter()

@router.get("/departments")
def get_departments():
    return DEPARTMENTS

@router.get("/departments/{department_id}")
def get_department(department_id: str):
    for dep in DEPARTMENTS:
        if dep.id == department_id:
            return dep
    raise HTTPException(status_code=404, detail="Department not found")

@router.get("/forms/{form_id}")
def get_form(form_id: str):
    form = FORM_TEMPLATES.get(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form

@router.post("/submissions")
async def create_submission(
    subject: str = Form(""),
    description: str = Form(""),
    attachment: Optional[UploadFile] = File(None),
):
    return {
        "message": "submitted",
        "subject": subject,
        "description": description,
        "file": attachment.filename if attachment else None,
    }