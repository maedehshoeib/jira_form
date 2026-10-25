"""Stable portal target ids for admin-managed form cards.

Custom forms reuse the portal's ``department / section / form`` triple so that
submissions, form access and task duties keep working unchanged.
"""

CUSTOM_DEPARTMENT_ID = "custom"
CUSTOM_DEPARTMENT_TITLE = "کارت‌های سفارشی"
_SECTION_PREFIX = "card-"
_FORM_PREFIX = "custom-"
_GROUP_PREFIX = "group-"
_DOCUMENT_PREFIX = "document-"


def custom_section_id(card_id: int) -> str:
    return f"{_SECTION_PREFIX}{card_id}"


def custom_form_id(card_id: int) -> str:
    return f"{_FORM_PREFIX}{card_id}"


def group_target_id(card_id: int) -> str:
    return f"{_GROUP_PREFIX}{card_id}"


def document_target_id(card_id: int) -> str:
    return f"{_DOCUMENT_PREFIX}{card_id}"


def _parse_prefixed_id(value: str, prefix: str) -> int | None:
    if not value.startswith(prefix):
        return None
    raw = value[len(prefix) :]
    if not raw.isascii() or not raw.isdigit():
        return None
    return int(raw)


def parse_custom_form_id(form_id: str) -> int | None:
    """Return the card id for ``custom-<n>`` form ids, otherwise ``None``."""
    return _parse_prefixed_id(form_id, _FORM_PREFIX)


def parse_custom_section_id(section_id: str) -> int | None:
    """Return the card id for ``card-<n>`` section ids, otherwise ``None``."""
    return _parse_prefixed_id(section_id, _SECTION_PREFIX)
