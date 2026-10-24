"""Stable portal target ids for admin-managed form cards.

Custom forms reuse the portal's ``department / section / form`` triple so that
submissions, form access and task duties keep working unchanged.
"""

CUSTOM_DEPARTMENT_ID = "custom"
CUSTOM_DEPARTMENT_TITLE = "کارت‌های سفارشی"
_SECTION_PREFIX = "card-"
_FORM_PREFIX = "custom-"


def custom_section_id(card_id: int) -> str:
    return f"{_SECTION_PREFIX}{card_id}"


def custom_form_id(card_id: int) -> str:
    return f"{_FORM_PREFIX}{card_id}"


def parse_custom_form_id(form_id: str) -> int | None:
    """Return the card id for ``custom-<n>`` form ids, otherwise ``None``."""
    if not form_id.startswith(_FORM_PREFIX):
        return None
    raw = form_id[len(_FORM_PREFIX) :]
    if not raw.isascii() or not raw.isdigit():
        return None
    return int(raw)
