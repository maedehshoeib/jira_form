from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.calendar import (
    CalendarEventPayload,
    CalendarEventResponse,
    CalendarUserResponse,
)
from app.services.calendar_service import CalendarService

router = APIRouter()


def get_calendar_service(db: Session = Depends(get_db)) -> CalendarService:
    return CalendarService(db)


@router.get("/users", response_model=list[CalendarUserResponse])
def calendar_users(
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
):
    return service.list_users(current_user)


@router.get("/events", response_model=list[CalendarEventResponse])
def list_events(
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
):
    return service.list_events(current_user)


@router.post("/events", response_model=list[CalendarEventResponse], status_code=201)
def create_event(
    body: CalendarEventPayload,
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
):
    return service.create_event(current_user, body)


@router.put("/events/{event_id}", response_model=CalendarEventResponse)
def update_event(
    event_id: int,
    body: CalendarEventPayload,
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
):
    return service.update_event(current_user, event_id, body)


@router.delete("/events/{event_id}", status_code=204)
def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
):
    service.delete_event(current_user, event_id)


@router.get("/notifications/unread")
def unread_notifications(
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
):
    return service.unread_notifications(current_user)


@router.post("/notifications/read", status_code=204)
def read_notifications(
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
):
    service.mark_notifications_read(current_user)
