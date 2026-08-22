from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, aliased

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.calendar_event import CalendarEvent, CalendarNotification
from datetime import datetime
from app.models.user import User
from app.schemas.calendar import CalendarEventPayload, CalendarEventResponse, CalendarUserResponse

router = APIRouter()


def _notify_assignee(db: Session, event: CalendarEvent, actor: User, target: User) -> None:
    if actor.is_admin and target.id != actor.id and not target.is_admin:
        db.add(CalendarNotification(event_id=event.id, user_id=target.id, created_by_id=actor.id))


def _serialize(event: CalendarEvent, owner: User, creator: User) -> CalendarEventResponse:
    return CalendarEventResponse(
        id=event.id, title=event.title, description=event.description,
        location=event.location, jalali_date=event.jalali_date,
        start_time=event.start_time, end_time=event.end_time, color=event.color,
        user_id=event.user_id, user_name=owner.display_name or owner.username,
        created_by_id=event.created_by_id,
        created_by_name=creator.display_name or creator.username,
        created_at=event.created_at, updated_at=event.updated_at,
    )


def _event_row(db: Session, event_id: int):
    owner, creator = aliased(User), aliased(User)
    return (db.query(CalendarEvent, owner, creator)
            .join(owner, CalendarEvent.user_id == owner.id)
            .join(creator, CalendarEvent.created_by_id == creator.id)
            .filter(CalendarEvent.id == event_id).first())


@router.get("/users", response_model=list[CalendarUserResponse])
def calendar_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        return [current_user]
    return (db.query(User).filter(User.is_active.is_(True), User.is_admin.is_(False))
            .order_by(User.display_name, User.username).all())


@router.get("/events", response_model=list[CalendarEventResponse])
def list_events(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owner, creator = aliased(User), aliased(User)
    query = (db.query(CalendarEvent, owner, creator)
             .join(owner, CalendarEvent.user_id == owner.id)
             .join(creator, CalendarEvent.created_by_id == creator.id))
    if not current_user.is_admin:
        query = query.filter(CalendarEvent.user_id == current_user.id)
    rows = query.order_by(CalendarEvent.jalali_date, CalendarEvent.start_time).all()
    return [_serialize(event, event_owner, event_creator) for event, event_owner, event_creator in rows]


@router.post("/events", response_model=CalendarEventResponse, status_code=201)
def create_event(body: CalendarEventPayload, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    target_id = body.user_id if current_user.is_admin and body.user_id else current_user.id
    target = db.query(User).filter(User.id == target_id, User.is_active.is_(True)).first()
    if not target or (current_user.is_admin and target.is_admin and target.id != current_user.id):
        raise HTTPException(status_code=404, detail="Calendar user not found.")
    event = CalendarEvent(**body.model_dump(exclude={"user_id"}), user_id=target.id, created_by_id=current_user.id)
    db.add(event)
    db.flush()
    _notify_assignee(db, event, current_user, target)
    db.commit()
    db.refresh(event)
    return _serialize(event, target, current_user)


@router.put("/events/{event_id}", response_model=CalendarEventResponse)
def update_event(event_id: int, body: CalendarEventPayload, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _event_row(db, event_id)
    if not row:
        raise HTTPException(status_code=404, detail="Calendar event not found.")
    event, _, _ = row
    if not current_user.is_admin and event.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    target_id = body.user_id if current_user.is_admin and body.user_id else event.user_id
    target = db.query(User).filter(User.id == target_id, User.is_active.is_(True)).first()
    if not target:
        raise HTTPException(status_code=404, detail="Calendar user not found.")
    for key, value in body.model_dump(exclude={"user_id"}).items():
        setattr(event, key, value)
    event.user_id = target.id
    _notify_assignee(db, event, current_user, target)
    db.commit()
    db.refresh(event)
    return _serialize(event, target, db.get(User, event.created_by_id))


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.get(CalendarEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found.")
    if not current_user.is_admin and event.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    db.query(CalendarNotification).filter(CalendarNotification.event_id == event.id).delete()
    db.delete(event)
    db.commit()


@router.get("/notifications/unread")
def unread_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    creator = aliased(User)
    rows = (db.query(CalendarNotification, CalendarEvent, creator)
            .join(CalendarEvent, CalendarNotification.event_id == CalendarEvent.id)
            .join(creator, CalendarNotification.created_by_id == creator.id)
            .filter(CalendarNotification.user_id == current_user.id, CalendarNotification.read_at.is_(None))
            .order_by(CalendarNotification.created_at.desc()).limit(10).all())
    return {
        "count": db.query(CalendarNotification).filter(
            CalendarNotification.user_id == current_user.id,
            CalendarNotification.read_at.is_(None),
        ).count(),
        "items": [{
            "id": notification.id,
            "event_id": event.id,
            "title": event.title,
            "jalali_date": event.jalali_date,
            "start_time": event.start_time,
            "created_by_name": actor.display_name or actor.username,
        } for notification, event, actor in rows],
    }


@router.post("/notifications/read", status_code=204)
def read_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(CalendarNotification).filter(
        CalendarNotification.user_id == current_user.id,
        CalendarNotification.read_at.is_(None),
    ).update({CalendarNotification.read_at: datetime.utcnow()}, synchronize_session=False)
    db.commit()
