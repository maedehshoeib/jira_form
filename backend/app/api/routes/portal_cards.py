from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.portal_card import (
    CardFormSchema,
    CardKind,
    PortalCardAdminDetail,
    PortalCardContentUpdate,
    PortalCardDetail,
    PortalCardFields,
    PortalCardMove,
    PortalCardReorder,
    PortalCardSummary,
)
from app.services.portal_card_admin_service import PortalCardAdminService
from app.services.portal_card_service import PortalCardService

router = APIRouter()
admin_router = APIRouter()


def get_portal_card_service(db: Session = Depends(get_db)) -> PortalCardService:
    return PortalCardService(db)


def get_portal_card_admin_service(
    db: Session = Depends(get_db),
) -> PortalCardAdminService:
    return PortalCardAdminService(db)


def _parse_fields(
    title: str, description: str, is_published: bool
) -> PortalCardFields:
    try:
        return PortalCardFields(
            title=title, description=description, is_published=is_published
        )
    except ValidationError as exc:
        message = exc.errors()[0].get("msg", "داده‌های واردشده نامعتبر است.")
        raise HTTPException(status_code=422, detail=message) from exc


# ---------------------------------------------------------------- public API


@router.get("", response_model=list[PortalCardSummary])
def list_cards(
    parent_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    service: PortalCardService = Depends(get_portal_card_service),
):
    return service.list_children(user, parent_id)


@router.get("/{card_id}", response_model=PortalCardDetail)
def get_card(
    card_id: int,
    user: User = Depends(get_current_user),
    service: PortalCardService = Depends(get_portal_card_service),
):
    return service.get_detail(user, card_id)


@router.get("/{card_id}/logo")
def get_card_logo(
    card_id: int,
    service: PortalCardService = Depends(get_portal_card_service),
):
    # Public like news/job-description images so <img src> works without headers.
    path, filename, media_type = service.resolve_logo(card_id)
    return FileResponse(path, media_type=media_type, filename=filename)


@router.get("/{card_id}/files/{file_id}")
def download_card_file(
    card_id: int,
    file_id: int,
    user: User = Depends(get_current_user),
    service: PortalCardService = Depends(get_portal_card_service),
):
    path, filename, media_type = service.resolve_file(user, card_id, file_id)
    return FileResponse(path, media_type=media_type, filename=filename)


# ----------------------------------------------------------------- admin API


@admin_router.get("", response_model=list[PortalCardSummary])
def admin_list_cards(
    _: User = Depends(get_admin_user),
    service: PortalCardService = Depends(get_portal_card_service),
):
    return service.list_all_for_admin()


@admin_router.post("", response_model=PortalCardAdminDetail, status_code=201)
async def admin_create_card(
    kind: CardKind = Form(...),
    title: str = Form(...),
    description: str = Form(default=""),
    is_published: bool = Form(default=True),
    parent_id: int | None = Form(default=None),
    logo: UploadFile | None = File(None),
    actor: User = Depends(get_admin_user),
    service: PortalCardAdminService = Depends(get_portal_card_admin_service),
):
    fields = _parse_fields(title, description, is_published)
    return await service.create(actor, kind, parent_id, fields, logo)


@admin_router.post("/reorder", status_code=204)
def admin_reorder_cards(
    body: PortalCardReorder,
    _: User = Depends(get_admin_user),
    service: PortalCardAdminService = Depends(get_portal_card_admin_service),
):
    service.reorder(body.parent_id, body.ordered_ids)


@admin_router.get("/{card_id}", response_model=PortalCardAdminDetail)
def admin_get_card(
    card_id: int,
    _: User = Depends(get_admin_user),
    service: PortalCardService = Depends(get_portal_card_service),
):
    return service.get_admin_detail(card_id)


@admin_router.put("/{card_id}", response_model=PortalCardAdminDetail)
async def admin_update_card(
    card_id: int,
    title: str = Form(...),
    description: str = Form(default=""),
    is_published: bool = Form(default=True),
    remove_logo: bool = Form(default=False),
    logo: UploadFile | None = File(None),
    _: User = Depends(get_admin_user),
    service: PortalCardAdminService = Depends(get_portal_card_admin_service),
):
    fields = _parse_fields(title, description, is_published)
    return await service.update(card_id, fields, logo, remove_logo=remove_logo)


@admin_router.delete("/{card_id}", status_code=204)
def admin_delete_card(
    card_id: int,
    _: User = Depends(get_admin_user),
    service: PortalCardAdminService = Depends(get_portal_card_admin_service),
):
    service.delete(card_id)


@admin_router.post("/{card_id}/move", response_model=PortalCardAdminDetail)
def admin_move_card(
    card_id: int,
    body: PortalCardMove,
    _: User = Depends(get_admin_user),
    service: PortalCardAdminService = Depends(get_portal_card_admin_service),
):
    return service.move(card_id, body.parent_id)


@admin_router.put("/{card_id}/form", response_model=PortalCardAdminDetail)
def admin_update_card_form(
    card_id: int,
    body: CardFormSchema,
    _: User = Depends(get_admin_user),
    service: PortalCardAdminService = Depends(get_portal_card_admin_service),
):
    return service.set_form(card_id, body)


@admin_router.put("/{card_id}/content", response_model=PortalCardAdminDetail)
def admin_update_card_content(
    card_id: int,
    body: PortalCardContentUpdate,
    _: User = Depends(get_admin_user),
    service: PortalCardAdminService = Depends(get_portal_card_admin_service),
):
    return service.set_content(card_id, body.content)


@admin_router.post("/{card_id}/files", response_model=PortalCardAdminDetail)
async def admin_add_card_file(
    card_id: int,
    title: str = Form(default=""),
    file: UploadFile | None = File(None),
    _: User = Depends(get_admin_user),
    service: PortalCardAdminService = Depends(get_portal_card_admin_service),
):
    return await service.add_file(card_id, title, file)


@admin_router.delete("/{card_id}/files/{file_id}", response_model=PortalCardAdminDetail)
def admin_delete_card_file(
    card_id: int,
    file_id: int,
    _: User = Depends(get_admin_user),
    service: PortalCardAdminService = Depends(get_portal_card_admin_service),
):
    return service.delete_file(card_id, file_id)
