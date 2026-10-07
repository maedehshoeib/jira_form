from datetime import datetime

from sqlalchemy.orm import Session, aliased

from app.models.calendar_event import CalendarEvent, CalendarNotification
from app.models.user import User
from app.repositories.base import BaseRepository


class CalendarRepository(BaseRepository):
    def list_assignable_users(self) -> list[User]:
        return (
            self.db.query(User)
            .filter(User.is_active.is_(True))
            .order_by(User.display_name, User.username)
            .all()
        )

    def get_active_user(self, user_id: int) -> User | None:
        return (
            self.db.query(User)
            .filter(User.id == user_id, User.is_active.is_(True))
            .first()
        )

    def get_user(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def list_events_with_users(
        self, *, owner_user_id: int | None = None
    ) -> list[tuple[CalendarEvent, User, User]]:
        owner, creator = aliased(User), aliased(User)
        query = (
            self.db.query(CalendarEvent, owner, creator)
            .join(owner, CalendarEvent.user_id == owner.id)
            .join(creator, CalendarEvent.created_by_id == creator.id)
        )
        if owner_user_id is not None:
            query = query.filter(CalendarEvent.user_id == owner_user_id)
        return query.order_by(CalendarEvent.jalali_date, CalendarEvent.start_time).all()

    def get_event_with_users(
        self, event_id: int
    ) -> tuple[CalendarEvent, User, User] | None:
        owner, creator = aliased(User), aliased(User)
        return (
            self.db.query(CalendarEvent, owner, creator)
            .join(owner, CalendarEvent.user_id == owner.id)
            .join(creator, CalendarEvent.created_by_id == creator.id)
            .filter(CalendarEvent.id == event_id)
            .first()
        )

    def get_event(self, event_id: int) -> CalendarEvent | None:
        return self.db.get(CalendarEvent, event_id)

    def add_event(self, event: CalendarEvent) -> CalendarEvent:
        self.db.add(event)
        return event

    def add_notification(
        self, *, event_id: int, user_id: int, created_by_id: int
    ) -> None:
        self.db.add(
            CalendarNotification(
                event_id=event_id,
                user_id=user_id,
                created_by_id=created_by_id,
            )
        )

    def flush(self) -> None:
        self.db.flush()

    def delete_notifications_for_event(self, event_id: int) -> None:
        self.db.query(CalendarNotification).filter(
            CalendarNotification.event_id == event_id
        ).delete()

    def delete_event(self, event: CalendarEvent) -> None:
        self.db.delete(event)

    def list_unread_notifications(
        self, user_id: int, *, limit: int = 10
    ) -> list[tuple[CalendarNotification, CalendarEvent, User]]:
        creator = aliased(User)
        return (
            self.db.query(CalendarNotification, CalendarEvent, creator)
            .join(CalendarEvent, CalendarNotification.event_id == CalendarEvent.id)
            .join(creator, CalendarNotification.created_by_id == creator.id)
            .filter(
                CalendarNotification.user_id == user_id,
                CalendarNotification.read_at.is_(None),
            )
            .order_by(CalendarNotification.created_at.desc())
            .limit(limit)
            .all()
        )

    def count_unread(self, user_id: int) -> int:
        return (
            self.db.query(CalendarNotification)
            .filter(
                CalendarNotification.user_id == user_id,
                CalendarNotification.read_at.is_(None),
            )
            .count()
        )

    def mark_notifications_read(self, user_id: int, read_at: datetime) -> None:
        self.db.query(CalendarNotification).filter(
            CalendarNotification.user_id == user_id,
            CalendarNotification.read_at.is_(None),
        ).update(
            {CalendarNotification.read_at: read_at},
            synchronize_session=False,
        )
