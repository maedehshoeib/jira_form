from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.job_description import JobDescriptionFields, JobDescriptionResponse
from app.services.job_description_service import JobDescriptionService

router = APIRouter()
admin_router = APIRouter()


def get_job_description_service(
    db: Session = Depends(get_db),
) -> JobDescriptionService:
    return JobDescriptionService(db)


def _parse_fields(
    organizational_position: str,
    organizational_unit: str,
    unit_responsibility: str,
    qualification_requirements: str,
) -> JobDescriptionFields:
    try:
        return JobDescriptionFields(
            organizational_position=organizational_position,
            organizational_unit=organizational_unit,
            unit_responsibility=unit_responsibility,
            qualification_requirements=qualification_requirements,
        )
    except ValidationError as exc:
        message = exc.errors()[0].get("msg", "داده‌های واردشده نامعتبر است.")
        raise HTTPException(status_code=422, detail=message) from exc


@router.get("", response_model=list[JobDescriptionResponse])
def list_job_descriptions(
    _: User = Depends(get_current_user),
    service: JobDescriptionService = Depends(get_job_description_service),
):
    return service.list_items()


@router.get("/{item_id}", response_model=JobDescriptionResponse)
def get_job_description(
    item_id: int,
    _: User = Depends(get_current_user),
    service: JobDescriptionService = Depends(get_job_description_service),
):
    return service.get_item(item_id)


@router.get("/{item_id}/photo")
def get_job_description_photo(
    item_id: int,
    service: JobDescriptionService = Depends(get_job_description_service),
):
    # Public image URL pattern matches news/banner so <img src> works after login listing.
    path, filename, media_type = service.resolve_photo(item_id)
    return FileResponse(path, media_type=media_type, filename=filename)


@router.get("/{item_id}/attachment")
def get_job_description_attachment(
    item_id: int,
    _: User = Depends(get_current_user),
    service: JobDescriptionService = Depends(get_job_description_service),
):
    path, filename, media_type = service.resolve_attachment(item_id)
    return FileResponse(path, media_type=media_type, filename=filename)


@admin_router.post("", response_model=JobDescriptionResponse, status_code=201)
async def create_job_description(
    organizational_position: str = Form(...),
    organizational_unit: str = Form(...),
    unit_responsibility: str = Form(...),
    qualification_requirements: str = Form(...),
    photo: UploadFile | None = File(None),
    attachment: UploadFile | None = File(None),
    current_user: User = Depends(get_admin_user),
    service: JobDescriptionService = Depends(get_job_description_service),
):
    fields = _parse_fields(
        organizational_position,
        organizational_unit,
        unit_responsibility,
        qualification_requirements,
    )
    return await service.create(current_user, fields, photo, attachment)


@admin_router.put("/{item_id}", response_model=JobDescriptionResponse)
async def update_job_description(
    item_id: int,
    organizational_position: str = Form(...),
    organizational_unit: str = Form(...),
    unit_responsibility: str = Form(...),
    qualification_requirements: str = Form(...),
    remove_photo: bool = Form(default=False),
    remove_attachment: bool = Form(default=False),
    photo: UploadFile | None = File(None),
    attachment: UploadFile | None = File(None),
    _: User = Depends(get_admin_user),
    service: JobDescriptionService = Depends(get_job_description_service),
):
    fields = _parse_fields(
        organizational_position,
        organizational_unit,
        unit_responsibility,
        qualification_requirements,
    )
    return await service.update(
        item_id,
        fields,
        photo,
        attachment,
        remove_photo=remove_photo,
        remove_attachment=remove_attachment,
    )


@admin_router.delete("/{item_id}", status_code=204)
def delete_job_description(
    item_id: int,
    _: User = Depends(get_admin_user),
    service: JobDescriptionService = Depends(get_job_description_service),
):
    service.delete(item_id)
