"""Pure helpers that turn a stored card form schema into a portal form template."""

import json

from pydantic import ValidationError

from app.models.portal_card import PortalCard
from app.schemas.portal import FormField, FormTemplate, SelectOption, TableColumn
from app.schemas.portal_card import CardFormField, CardFormSchema
from app.services.portal_card_targets import (
    CUSTOM_DEPARTMENT_ID,
    custom_form_id,
    custom_section_id,
)

SUBJECT_MAX_LENGTH = 500


def parse_schema(raw: str | None) -> CardFormSchema:
    """Return the stored schema; a missing or corrupt value yields an empty form."""
    if not raw:
        return CardFormSchema()
    try:
        return CardFormSchema.model_validate_json(raw)
    except (ValidationError, ValueError):
        return CardFormSchema()


def build_template(card: PortalCard) -> FormTemplate:
    schema = parse_schema(card.form_schema)
    fields: list[FormField] = []
    for section in schema.sections:
        for field in section.fields:
            fields.append(_to_form_field(field, section.title or None))
    return FormTemplate(
        id=custom_form_id(card.id),
        title=card.title,
        department_id=CUSTOM_DEPARTMENT_ID,
        section_id=custom_section_id(card.id),
        fields=fields,
    )


def _to_form_field(field: CardFormField, section_title: str | None) -> FormField:
    columns = [TableColumn(key=col.key, title=col.title) for col in field.columns]
    default_rows = (
        [{col.key: "" for col in field.columns} for _ in range(field.initial_rows)]
        if field.type == "table"
        else []
    )
    return FormField(
        name=field.name,
        label=field.label,
        type=field.type,
        required=field.required,
        placeholder=field.placeholder or None,
        options=[SelectOption(label=o.label, value=o.value) for o in field.options],
        section=section_title,
        columns=columns,
        default_rows=default_rows,
        visible_when_field=field.visible_when_field,
        visible_when_value=field.visible_when_value,
    )


def _all_fields(schema: CardFormSchema) -> list[CardFormField]:
    return [field for section in schema.sections for field in section.fields]


def _table_has_content(raw: str) -> bool:
    try:
        rows = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return False
    if not isinstance(rows, list):
        return False
    return any(
        isinstance(row, dict) and any(str(cell).strip() for cell in row.values())
        for row in rows
    )


def _is_filled(field: CardFormField, value: str) -> bool:
    if field.type == "table":
        return _table_has_content(value)
    return bool(value.strip())


def validate_submission(schema: CardFormSchema, form_data: dict) -> dict:
    """Validate submitted values against the schema and return the cleaned data.

    Only declared fields are kept; fields hidden by a visibility rule are dropped.
    Raises ``ValueError`` with a Persian message for the first problem found.
    """
    fields = _all_fields(schema)
    cleaned: dict = {}
    for field in fields:
        if field.visible_when_field and (
            str(form_data.get(field.visible_when_field, "")) != field.visible_when_value
        ):
            continue
        value = str(form_data.get(field.name, "") or "")
        if not _is_filled(field, value):
            if field.required:
                raise ValueError(f"تکمیل فیلد «{field.label}» الزامی است.")
            continue
        _check_value(field, value)
        cleaned[field.name] = value
    return cleaned


def _check_value(field: CardFormField, value: str) -> None:
    if field.type == "select" and value not in {o.value for o in field.options}:
        raise ValueError(f"مقدار انتخاب‌شده برای «{field.label}» نامعتبر است.")
    if field.type == "number":
        try:
            float(value)
        except ValueError as exc:
            raise ValueError(f"مقدار «{field.label}» باید عدد باشد.") from exc
    if field.type == "email" and ("@" not in value or len(value) > 254):
        raise ValueError(f"ایمیل واردشده برای «{field.label}» نامعتبر است.")
    if len(value) > 20000:
        raise ValueError(f"مقدار «{field.label}» بیش از حد طولانی است.")


def derive_subject(schema: CardFormSchema, data: dict, fallback_title: str) -> str:
    """Use the first filled text field as the submission subject."""
    for field in _all_fields(schema):
        if field.type == "text" and str(data.get(field.name, "")).strip():
            return str(data[field.name]).strip()[:SUBJECT_MAX_LENGTH]
    return fallback_title[:SUBJECT_MAX_LENGTH]
