"""Decide which admin-built cards a non-admin can open."""

from collections import defaultdict

from app.models.portal_card import PortalCard


def visible_card_ids(
    cards: list[PortalCard], *, open_access: bool, explicit: set[int]
) -> set[int]:
    """Return card ids the user may see.

    ``open_access`` means the user has no personal or department allow-list, so
    every published card is visible. ``explicit`` holds cards granted directly,
    granted through a parent group, or assigned in task routing. An explicit
    card is visible even while it is still a draft, and its ancestors stay
    visible so the user can navigate to it.
    """
    children: dict[int | None, list[PortalCard]] = defaultdict(list)
    for card in cards:
        children[card.parent_id].append(card)
    visible: set[int] = set()

    def walk(card: PortalCard, blocked: bool, inherited: bool) -> bool:
        granted = card.id in explicit
        child_blocked = blocked or (not card.is_published and not granted)
        child_inherited = inherited or granted
        child_visible = [
            walk(child, child_blocked, child_inherited) for child in children[card.id]
        ]
        if card.kind == "group":
            shown = granted or inherited or any(child_visible)
        elif granted or inherited:
            shown = True
        elif blocked or not card.is_published:
            shown = False
        else:
            shown = open_access
        if shown:
            visible.add(card.id)
        return shown

    for root in children[None]:
        walk(root, False, False)
    return visible
