from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.letter_folders import (
    LetterFolderCreate,
    LetterFolderItemCreate,
    LetterFolderItemResponse,
    LetterFolderResponse,
    LetterFolderUpdate,
)
from app.services.letter_folder_service import LetterFolderService

router = APIRouter(prefix="/management-letters/folders", tags=["management-letters"])


def get_letter_folder_service(db: Session = Depends(get_db)) -> LetterFolderService:
    return LetterFolderService(db)


@router.get("", response_model=list[LetterFolderResponse])
def list_letter_folders(
    scope: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    service: LetterFolderService = Depends(get_letter_folder_service),
):
    return service.list_folders(current_user, scope=scope)


@router.post("", response_model=LetterFolderResponse, status_code=status.HTTP_201_CREATED)
def create_letter_folder(
    body: LetterFolderCreate,
    current_user: User = Depends(get_current_user),
    service: LetterFolderService = Depends(get_letter_folder_service),
):
    return service.create_folder(current_user, body)


@router.patch("/{folder_id}", response_model=LetterFolderResponse)
def rename_letter_folder(
    folder_id: int,
    body: LetterFolderUpdate,
    current_user: User = Depends(get_current_user),
    service: LetterFolderService = Depends(get_letter_folder_service),
):
    return service.rename_folder(current_user, folder_id, body)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_letter_folder(
    folder_id: int,
    current_user: User = Depends(get_current_user),
    service: LetterFolderService = Depends(get_letter_folder_service),
):
    service.delete_folder(current_user, folder_id)


@router.post(
    "/{folder_id}/items",
    response_model=LetterFolderItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_letter_folder_item(
    folder_id: int,
    body: LetterFolderItemCreate,
    current_user: User = Depends(get_current_user),
    service: LetterFolderService = Depends(get_letter_folder_service),
):
    return service.add_item(current_user, folder_id, body)


@router.delete(
    "/{folder_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_letter_folder_item(
    folder_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    service: LetterFolderService = Depends(get_letter_folder_service),
):
    service.remove_item(current_user, folder_id, item_id)
