from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.form_template import (
    DepartmentFormAccess,
    FormDutyAssignment,
    UserFormAccess,
)
from app.models.portal_card import PortalCard
from app.models.user import User
from app.repositories.portal_card import PortalCardRepository
from app.services.portal_card_targets import (
    CUSTOM_DEPARTMENT_ID,
    CUSTOM_DEPARTMENT_TITLE,
    custom_form_id,
    custom_section_id,
    document_target_id,
    group_target_id,
    parse_custom_form_id,
    parse_custom_section_id,
)
from app.services.portal_service import (
    DEPARTMENTS,
    INTERNAL_LETTERS_WORKFLOW_ID,
    MANAGEMENT_WORKFLOW_ID,
)


# Visible only to admins or users/departments explicitly granted access.
RESTRICTED_PORTAL_DEPARTMENTS = frozenset(
    {MANAGEMENT_WORKFLOW_ID, INTERNAL_LETTERS_WORKFLOW_ID}
)


@dataclass(frozen=True)
class AccessTarget:
    portal_department_id: str
    portal_department_title: str
    section_id: str
    section_title: str
    form_id: str
    kind: str = ""
    is_published: bool = True

    @property
    def key(self) -> str:
        return f"{self.portal_department_id}:{self.section_id}:{self.form_id}"


def _access_form_id(card: PortalCard) -> str:
    if card.kind == "form":
        return custom_form_id(card.id)
    if card.kind == "document":
        return document_target_id(card.id)
    return group_target_id(card.id)


def custom_card_targets(db: Session) -> list[AccessTarget]:
    """Targets for every admin-built card; the section title carries the card path."""
    cards = PortalCardRepository(db).list_all()
    by_id = {card.id: card for card in cards}
    targets: list[AccessTarget] = []
    for card in cards:
        trail, seen, parent = [card.title], {card.id}, by_id.get(card.parent_id)
        while parent is not None and parent.id not in seen:
            trail.append(parent.title)
            seen.add(parent.id)
            parent = by_id.get(parent.parent_id)
        targets.append(
            AccessTarget(
                portal_department_id=CUSTOM_DEPARTMENT_ID,
                portal_department_title=CUSTOM_DEPARTMENT_TITLE,
                section_id=custom_section_id(card.id),
                section_title=" › ".join(reversed(trail)),
                form_id=_access_form_id(card),
                kind=card.kind,
                is_published=bool(card.is_published),
            )
        )
    return targets


def access_catalog(db: Session | None = None) -> list[AccessTarget]:
    """Return every grantable target; pass ``db`` to include admin-built cards."""
    targets: list[AccessTarget] = []
    for department in DEPARTMENTS:
        if department.sections:
            targets.extend(
                AccessTarget(
                    portal_department_id=department.id,
                    portal_department_title=department.title,
                    section_id=section.id,
                    section_title=section.title,
                    form_id=section.form_id,
                )
                for section in department.sections
            )
        else:
            # Standalone home-page applications (contract archive, management workflow).
            targets.append(
                AccessTarget(
                    portal_department_id=department.id,
                    portal_department_title=department.title,
                    section_id="",
                    section_title=department.title,
                    form_id=department.id,
                )
            )
    if db is not None:
        targets.extend(custom_card_targets(db))
    return targets


def duty_catalog(db: Session | None = None) -> list[AccessTarget]:
    """Return routes that can own task-duty assignments.

    Custom groups are included because a duty on a group covers the forms
    inside it. Documents have no submission to route.
    """
    return [
        target
        for target in access_catalog(db)
        if target.section_id and target.kind != "document"
    ]


def target_key(portal_department_id: str, section_id: str, form_id: str) -> str:
    return f"{portal_department_id}:{section_id}:{form_id}"


def restricted_department_key(portal_department_id: str) -> str:
    return target_key(portal_department_id, "", portal_department_id)


def parse_target_keys(
    keys: list[str], db: Session | None = None
) -> list[AccessTarget]:
    by_key = {target.key: target for target in access_catalog(db)}
    invalid = sorted(set(keys) - set(by_key))
    if invalid:
        raise ValueError(f"Unknown form access target: {invalid[0]}")
    return [by_key[key] for key in dict.fromkeys(keys)]


def parse_duty_target_keys(
    keys: list[str], db: Session | None = None
) -> list[AccessTarget]:
    by_key = {target.key: target for target in duty_catalog(db)}
    invalid = sorted(set(keys) - set(by_key))
    if invalid:
        raise ValueError(f"Unknown form duty target: {invalid[0]}")
    return [by_key[key] for key in dict.fromkeys(keys)]


def allowed_target_keys(db: Session, user: User) -> set[str] | None:
    """Return an allow-list, or None when legacy/default access means all."""
    if user.is_admin:
        return None
    if user.form_access_configured:
        rows = db.query(UserFormAccess).filter(UserFormAccess.user_id == user.id)
    elif user.department_id:
        from app.models.department import Department

        department = (
            db.query(Department).filter(Department.id == user.department_id).first()
        )
        if not department or not department.access_configured:
            return None
        rows = db.query(DepartmentFormAccess).filter(
            DepartmentFormAccess.department_id == department.id
        )
    else:
        return None
    return {
        target_key(row.portal_department_id, row.section_id, row.form_id)
        for row in rows.all()
    }


def can_access_restricted_department(
    db: Session, user: User, portal_department_id: str
) -> bool:
    if portal_department_id not in RESTRICTED_PORTAL_DEPARTMENTS:
        return True
    if user.is_admin:
        return True
    allowed = allowed_target_keys(db, user)
    if allowed is None:
        return False
    return restricted_department_key(portal_department_id) in allowed


def can_access_target(
    db: Session,
    user: User,
    portal_department_id: str,
    section_id: str,
    form_id: str,
) -> bool:
    if portal_department_id in RESTRICTED_PORTAL_DEPARTMENTS:
        return can_access_restricted_department(db, user, portal_department_id)
    allowed = allowed_target_keys(db, user)
    return allowed is None or target_key(
        portal_department_id, section_id, form_id
    ) in allowed


def expand_duty_targets(db: Session, assignments) -> list[tuple[str, str, str]]:
    """Triples a duty row should match.

    A group row covers every form card inside that group. Documents match nothing.
    """
    cards = PortalCardRepository(db).list_all()
    by_id = {card.id: card for card in cards}
    children: dict[int | None, list[PortalCard]] = defaultdict(list)
    for card in cards:
        children[card.parent_id].append(card)
    triples: list[tuple[str, str, str]] = []
    seen: set[tuple[str, str, str]] = set()

    def add(triple: tuple[str, str, str]) -> None:
        if triple not in seen:
            seen.add(triple)
            triples.append(triple)

    for assignment in assignments:
        department_id = assignment.portal_department_id
        if department_id != CUSTOM_DEPARTMENT_ID:
            add((department_id, assignment.section_id, assignment.form_id))
            continue
        card_id = parse_custom_section_id(assignment.section_id)
        card = by_id.get(card_id) if card_id is not None else None
        if card is None or card.kind == "document":
            continue
        if card.kind == "form":
            add((CUSTOM_DEPARTMENT_ID, custom_section_id(card.id), custom_form_id(card.id)))
            continue
        stack = list(children.get(card.id, []))
        while stack:
            current = stack.pop()
            if current.kind == "form":
                add(
                    (
                        CUSTOM_DEPARTMENT_ID,
                        custom_section_id(current.id),
                        custom_form_id(current.id),
                    )
                )
            elif current.kind == "group":
                stack.extend(children.get(current.id, []))
    return triples


def group_duty_user_ids(db: Session, department_id: str, form_id: str) -> list[int]:
    """Users whose group duty covers this custom form."""
    if department_id != CUSTOM_DEPARTMENT_ID:
        return []
    card_id = parse_custom_form_id(form_id)
    card = db.get(PortalCard, card_id) if card_id is not None else None
    if card is None:
        return []
    group_ids: list[int] = []
    seen = {card.id}
    parent_id = card.parent_id
    while parent_id and parent_id not in seen:
        seen.add(parent_id)
        parent = db.get(PortalCard, parent_id)
        if parent is None:
            break
        if parent.kind == "group":
            group_ids.append(parent.id)
        parent_id = parent.parent_id
    if not group_ids:
        return []
    clauses = [
        and_(
            FormDutyAssignment.section_id == custom_section_id(group_id),
            FormDutyAssignment.form_id == group_target_id(group_id),
        )
        for group_id in group_ids
    ]
    rows = (
        db.query(FormDutyAssignment.user_id)
        .filter(
            FormDutyAssignment.portal_department_id == CUSTOM_DEPARTMENT_ID,
            or_(*clauses),
        )
        .order_by(FormDutyAssignment.id.asc())
        .all()
    )
    return list(dict.fromkeys(row.user_id for row in rows))
