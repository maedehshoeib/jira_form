from dataclasses import dataclass

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.birthday import user_display_name
from app.models.form_template import FormDutyAssignment
from app.models.submission import Submission
from app.models.user import User
from app.services.form_access_service import (
    AccessTarget,
    access_catalog,
    parse_target_keys,
    target_key,
)


@dataclass(frozen=True)
class DutyEdge:
    user_id: int
    username: str
    display_name: str
    portal_department_id: str
    portal_department_title: str
    section_id: str
    section_title: str
    form_id: str

    @property
    def target_key(self) -> str:
        return target_key(self.portal_department_id, self.section_id, self.form_id)


def list_assignments(db: Session) -> list[DutyEdge]:
    rows = (
        db.query(FormDutyAssignment, User)
        .join(User, User.id == FormDutyAssignment.user_id)
        .order_by(User.display_name.asc(), User.username.asc(), FormDutyAssignment.id.asc())
        .all()
    )
    catalog = {target.key: target for target in access_catalog()}
    edges: list[DutyEdge] = []
    for assignment, user in rows:
        key = target_key(
            assignment.portal_department_id,
            assignment.section_id,
            assignment.form_id,
        )
        target = catalog.get(key)
        edges.append(
            DutyEdge(
                user_id=user.id,
                username=user.username,
                display_name=user_display_name(user) or user.username,
                portal_department_id=assignment.portal_department_id,
                portal_department_title=(
                    target.portal_department_title if target else assignment.portal_department_id
                ),
                section_id=assignment.section_id,
                section_title=target.section_title if target else assignment.section_id,
                form_id=assignment.form_id,
            )
        )
    return edges


def replace_assignments(
    db: Session, edges: list[tuple[int, str]]
) -> list[DutyEdge]:
    """Replace all duty edges. Each item is (user_id, target_key)."""
    if not edges:
        db.query(FormDutyAssignment).delete(synchronize_session=False)
        db.commit()
        return []

    user_ids = sorted({user_id for user_id, _ in edges})
    users = {
        user.id: user
        for user in db.query(User)
        .filter(User.id.in_(user_ids), User.is_active.is_(True))
        .all()
    }
    missing = [user_id for user_id in user_ids if user_id not in users]
    if missing:
        raise ValueError(f"Unknown or inactive user: {missing[0]}")

    target_keys = [key for _, key in edges]
    targets_by_key: dict[str, AccessTarget] = {
        target.key: target for target in parse_target_keys(target_keys)
    }

    seen: set[tuple[int, str]] = set()
    unique_edges: list[tuple[int, AccessTarget]] = []
    for user_id, key in edges:
        pair = (user_id, key)
        if pair in seen:
            continue
        seen.add(pair)
        unique_edges.append((user_id, targets_by_key[key]))

    db.query(FormDutyAssignment).delete(synchronize_session=False)
    db.add_all(
        [
            FormDutyAssignment(
                user_id=user_id,
                portal_department_id=target.portal_department_id,
                section_id=target.section_id,
                form_id=target.form_id,
            )
            for user_id, target in unique_edges
        ]
    )
    db.commit()
    return list_assignments(db)


def list_user_duty_assignments(db: Session, user_id: int) -> list[FormDutyAssignment]:
    return (
        db.query(FormDutyAssignment)
        .filter(FormDutyAssignment.user_id == user_id)
        .all()
    )


def user_handles_target(
    db: Session,
    user_id: int,
    portal_department_id: str,
    section_id: str,
    form_id: str,
) -> bool:
    return (
        db.query(FormDutyAssignment.id)
        .filter(
            FormDutyAssignment.user_id == user_id,
            FormDutyAssignment.portal_department_id == portal_department_id,
            FormDutyAssignment.section_id == section_id,
            FormDutyAssignment.form_id == form_id,
        )
        .first()
        is not None
    )


def list_duty_submissions(
    db: Session,
    user_id: int,
    *,
    form_id: str | None = None,
    department_id: str | None = None,
    section_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Submission]:
    assignments = list_user_duty_assignments(db, user_id)
    if not assignments:
        return []

    conditions = [
        and_(
            Submission.department_id == assignment.portal_department_id,
            Submission.section_id == assignment.section_id,
            Submission.form_id == assignment.form_id,
        )
        for assignment in assignments
    ]
    query = db.query(Submission).filter(or_(*conditions)).order_by(
        Submission.created_at.desc()
    )
    if form_id:
        query = query.filter(Submission.form_id == form_id)
    if department_id:
        query = query.filter(Submission.department_id == department_id)
    if section_id:
        query = query.filter(Submission.section_id == section_id)
    return query.offset(offset).limit(limit).all()
