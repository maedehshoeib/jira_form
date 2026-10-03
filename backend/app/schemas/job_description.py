from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class JobDescriptionFields(BaseModel):
    organizational_position: str = Field(min_length=1, max_length=256)
    organizational_unit: str = Field(min_length=1, max_length=256)
    unit_responsibility: str = Field(min_length=1, max_length=10000)
    qualification_requirements: str = Field(min_length=1, max_length=10000)

    @field_validator(
        "organizational_position",
        "organizational_unit",
        "unit_responsibility",
        "qualification_requirements",
    )
    @classmethod
    def strip_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("این فیلد الزامی است.")
        return normalized


class JobDescriptionResponse(BaseModel):
    id: int
    organizational_position: str
    organizational_unit: str
    unit_responsibility: str
    qualification_requirements: str
    photo_url: str | None = None
    photo_name: str = ""
    has_attachment: bool = False
    attachment_name: str = ""
    attachment_size: int = 0
    uploaded_by_id: int | None = None
    created_at: datetime
    updated_at: datetime
