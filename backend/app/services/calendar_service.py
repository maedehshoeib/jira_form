from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.calendar_event import CalendarEvent
from app.models.user import User
from app.repositories.calendar import CalendarRepository
from app.schemas.calendar import CalendarEventPayload, CalendarEventResponse
from app.services.base import BaseService


class CalendarService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self.repo = CalendarRepository(db)

    def list_users(self, actor: User) -> list[User]:
        if not actor.is_admin:
            return [actor]
        return self.repo.list_assignable_users()

    def list_events(self, actor: User) -> list[CalendarEventResponse]:
        owner_id = None if actor.is_admin else actor.id
        rows = self.repo.list_events_with_users(owner_user_id=owner_id)
        return [
            self._serialize(event, event_owner, event_creator)
            for event, event_owner, event_creator in rows
        ]

    def create_event(
        self, actor: User, body: CalendarEventPayload
    ) -> CalendarEventResponse:
        target_id = body.user_id if actor.is_admin and body.user_id else actor.id
        target = self.repo.get_active_user(target_id)
        if not target or (actor.is_admin and target.is_admin and target.id != actor.id):
            raise HTTPException(status_code=404, detail="Calendar user not found.")
        event = CalendarEvent(
            **body.model_dump(exclude={"user_id"}),
            user_id=target.id,
            created_by_id=actor.id,
        )
        self.repo.add_event(event)
        self.repo.flush()
        self._notify_assignee(event, actor, target)
        self.db.commit()
        self.db.refresh(event)
        return self._serialize(event, target, actor)

    def update_event(
        self, actor: User, event_id: int, body: CalendarEventPayload
    ) -> CalendarEventResponse:
        row = self.repo.get_event_with_users(event_id)
        if not row:
            raise HTTPException(status_code=404, detail="Calendar event not found.")
        event, _, _ = row
        if not actor.is_admin and event.user_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Access denied."
            )
        target_id = body.user_id if actor.is_admin and body.user_id else event.user_id
        target = self.repo.get_active_user(target_id)
        if not target:
            raise HTTPException(status_code=404, detail="Calendar user not found.")
        for key, value in body.model_dump(exclude={"user_id"}).items():
            setattr(event, key, value)
        event.user_id = target.id
        self._notify_assignee(event, actor, target)
        self.db.commit()
        self.db.refresh(event)
        creator = self.repo.get_user(event.created_by_id)
        return self._serialize(event, target, creator or actor)

    def delete_event(self, actor: User, event_id: int) -> None:
        event = self.repo.get_event(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Calendar event not found.")
        if not actor.is_admin and event.user_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Access denied."
            )
        self.repo.delete_notifications_for_event(event.id)
        self.repo.delete_event(event)
        self.db.commit()

    def unread_notifications(self, actor: User) -> dict:
        rows = self.repo.list_unread_notifications(actor.id, limit=10)
        return {
            "count": self.repo.count_unread(actor.id),
            "items": [
                {
                    "id": notification.id,
                    "event_id": event.id,
                    "title": event.title,
                    "jalali_date": event.jalali_date,
                    "start_time": event.start_time,
                    "created_by_name": creator.display_name or creator.username,
                }
                for notification, event, creator in rows
            ],
        }

    def mark_notifications_read(self, actor: User) -> None:
        self.repo.mark_notifications_read(actor.id, datetime.utcnow())
        self.db.commit()

    def _notify_assignee(
        self, event: CalendarEvent, actor: User, target: User
    ) -> None:
        if actor.is_admin and target.id != actor.id and not target.is_admin:
            self.repo.add_notification(
                event_id=event.id,
                user_id=target.id,
                created_by_id=actor.id,
            )

    @staticmethod
    def _serialize(
        event: CalendarEvent, owner: User, creator: User
    ) -> CalendarEventResponse:
        return CalendarEventResponse(
            id=event.id,
            title=event.title,
            description=event.description,
            location=event.location,
            jalali_date=event.jalali_date,
            start_time=event.start_time,
            end_time=event.end_time,
            color=event.color,
            user_id=event.user_id,
            user_name=owner.display_name or owner.username,
            created_by_id=event.created_by_id,
            created_by_name=creator.display_name or creator.username,
            created_at=event.created_at,
            updated_at=event.updated_at,
        )
