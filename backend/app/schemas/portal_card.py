"""Request/response contracts for admin-managed portal cards."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.portal import FormTemplate

CardKind = Literal["group", "form", "document"]
FieldType = Literal[
    "text", "textarea", "select", "date", "time", "file", "email", "number", "table"
]

NAME_PATTERN = r"^[a-z][a-z0-9_]{0,47}$"
RESERVED_FIELD_NAMES = frozenset({"form_id", "department_id", "section_id"})
MAX_SECTIONS = 30
MAX_FIELDS_PER_SECTION = 60
MAX_FIELDS_TOTAL = 200
MAX_OPTIONS = 100
MAX_COLUMNS = 12


class CardSelectOption(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    value: str = Field(min_length=1, max_length=200)

    @field_validator("label", "value")
    @classmethod
    def strip_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("مقدار گزینه نمی‌تواند خالی باشد.")
        return normalized


class CardTableColumn(BaseModel):
    key: str = Field(pattern=NAME_PATTERN)
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("عنوان ستون نمی‌تواند خالی باشد.")
        return normalized


class CardFormField(BaseModel):
    name: str = Field(pattern=NAME_PATTERN)
    label: str = Field(min_length=1, max_length=200)
    type: FieldType
    required: bool = False
    placeholder: str | None = Field(default=None, max_length=200)
    options: list[CardSelectOption] = Field(default_factory=list, max_length=MAX_OPTIONS)
    columns: list[CardTableColumn] = Field(default_factory=list, max_length=MAX_COLUMNS)
    initial_rows: int = Field(default=1, ge=0, le=20)
    visible_when_field: str | None = Field(default=None, max_length=48)
    visible_when_value: str | None = Field(default=None, max_length=200)

    @field_validator("label")
    @classmethod
    def strip_label(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("عنوان فیلد نمی‌تواند خالی باشد.")
        return normalized

    @model_validator(mode="after")
    def check_type_requirements(self) -> "CardFormField":
        if self.name in RESERVED_FIELD_NAMES:
            raise ValueError(f"نام فیلد «{self.name}» رزرو شده است.")
        if self.type == "select":
            if not self.options:
                raise ValueError(f"فیلد «{self.label}» باید حداقل یک گزینه داشته باشد.")
            values = [option.value for option in self.options]
            if len(set(values)) != len(values):
                raise ValueError(f"گزینه‌های فیلد «{self.label}» تکراری است.")
        if self.type == "table":
            if not self.columns:
                raise ValueError(f"جدول «{self.label}» باید حداقل یک ستون داشته باشد.")
            keys = [column.key for column in self.columns]
            if len(set(keys)) != len(keys):
                raise ValueError(f"ستون‌های جدول «{self.label}» تکراری است.")
        if bool(self.visible_when_field) != (self.visible_when_value is not None):
            raise ValueError(
                f"شرط نمایش فیلد «{self.label}» باید هم فیلد و هم مقدار داشته باشد."
            )
        return self


class CardFormSection(BaseModel):
    id: str = Field(pattern=NAME_PATTERN)
    title: str = Field(default="", max_length=200)
    fields: list[CardFormField] = Field(
        default_factory=list, max_length=MAX_FIELDS_PER_SECTION
    )

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        return value.strip()


class CardFormSchema(BaseModel):
    sections: list[CardFormSection] = Field(default_factory=list, max_length=MAX_SECTIONS)

    @model_validator(mode="after")
    def check_whole_form(self) -> "CardFormSchema":
        section_ids = [section.id for section in self.sections]
        if len(set(section_ids)) != len(section_ids):
            raise ValueError("شناسه بخش‌های فرم تکراری است.")
        fields = [field for section in self.sections for field in section.fields]
        if len(fields) > MAX_FIELDS_TOTAL:
            raise ValueError(f"تعداد فیلدهای فرم نباید از {MAX_FIELDS_TOTAL} بیشتر باشد.")
        names = [field.name for field in fields]
        if len(set(names)) != len(names):
            raise ValueError("شناسه فیلدهای فرم تکراری است.")
        known = set(names)
        for field in fields:
            if field.visible_when_field:
                if field.visible_when_field == field.name:
                    raise ValueError(f"فیلد «{field.label}» نمی‌تواند به خودش وابسته باشد.")
                if field.visible_when_field not in known:
                    raise ValueError(f"شرط نمایش فیلد «{field.label}» به فیلد نامعتبر اشاره دارد.")
        return self


class PortalCardFields(BaseModel):
    """Editable basics shared by create and update."""

    title: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=512)
    is_published: bool = True

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("عنوان کارت الزامی است.")
        return normalized

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        return value.strip()


class PortalCardContentUpdate(BaseModel):
    content: str = Field(default="", max_length=50000)


class PortalCardReorder(BaseModel):
    parent_id: int | None = None
    ordered_ids: list[int] = Field(max_length=500)


class PortalCardMove(BaseModel):
    parent_id: int | None = None


class PortalCardSummary(BaseModel):
    id: int
    parent_id: int | None = None
    kind: CardKind
    title: str
    description: str = ""
    logo_url: str | None = None
    sort_order: int = 0
    is_published: bool = True
    child_count: int = 0


class PortalCardBreadcrumb(BaseModel):
    id: int
    title: str


class PortalCardFileItem(BaseModel):
    id: int
    title: str
    file_name: str
    file_size: int
    is_pdf: bool = False


class PortalCardDetail(PortalCardSummary):
    breadcrumbs: list[PortalCardBreadcrumb] = Field(default_factory=list)
    children: list[PortalCardSummary] = Field(default_factory=list)
    form: FormTemplate | None = None
    content: str = ""
    files: list[PortalCardFileItem] = Field(default_factory=list)
    updated_at: datetime | None = None


class PortalCardAdminDetail(PortalCardDetail):
    form_schema: CardFormSchema | None = None
