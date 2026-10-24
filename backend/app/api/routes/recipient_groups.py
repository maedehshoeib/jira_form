from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.recipient_groups import RecipientGroupResponse, RecipientGroupWrite
from app.services.recipient_group_service import RecipientGroupService

router = APIRouter(prefix="/recipient-groups", tags=["recipient-groups"])


def get_recipient_group_service(
    db: Session = Depends(get_db),
) -> RecipientGroupService:
    return RecipientGroupService(db)


@router.get("", response_model=list[RecipientGroupResponse])
def list_recipient_groups(
    current_user: User = Depends(get_current_user),
    service: RecipientGroupService = Depends(get_recipient_group_service),
):
    return service.list_groups(current_user)


@router.post(
    "",
    response_model=RecipientGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_recipient_group(
    body: RecipientGroupWrite,
    current_user: User = Depends(get_current_user),
    service: RecipientGroupService = Depends(get_recipient_group_service),
):
    return service.create_group(current_user, body)


@router.put("/{group_id}", response_model=RecipientGroupResponse)
def update_recipient_group(
    group_id: int,
    body: RecipientGroupWrite,
    current_user: User = Depends(get_current_user),
    service: RecipientGroupService = Depends(get_recipient_group_service),
):
    return service.update_group(current_user, group_id, body)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipient_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    service: RecipientGroupService = Depends(get_recipient_group_service),
):
    service.delete_group(current_user, group_id)
