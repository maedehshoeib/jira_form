import re

from pydantic import BaseModel, Field, field_validator, model_validator


_DIGIT_TRANSLATION = str.maketrans(
    "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩",
    "01234567890123456789",
)
_TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
_JALALI_DATE_PATTERN = re.compile(r"^\d{4}/\d{2}/\d{2}$")


def normalize_digits(value: str) -> str:
    return value.translate(_DIGIT_TRANSLATION).strip()


def normalize_jalali_date(value: object) -> object:
    if not isinstance(value, str):
        return value
    normalized = normalize_digits(value)
    if not _JALALI_DATE_PATTERN.fullmatch(normalized):
        raise ValueError("تاریخ باید با قالب YYYY/MM/DD وارد شود")
    return normalized


class WorkDatePayload(BaseModel):
    work_date: str = Field(min_length=8, max_length=16)

    @field_validator("work_date", mode="before")
    @classmethod
    def normalize_date(cls, value: object) -> object:
        return normalize_jalali_date(value)


class CheckInPayload(WorkDatePayload):
    check_in_time: str

    @field_validator("check_in_time", mode="before")
    @classmethod
    def validate_time(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = normalize_digits(value)
        if not _TIME_PATTERN.fullmatch(normalized):
            raise ValueError("زمان باید با قالب HH:MM وارد شود")
        return normalized


class CheckOutPayload(WorkDatePayload):
    check_out_time: str

    @field_validator("check_out_time", mode="before")
    @classmethod
    def validate_time(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = normalize_digits(value)
        if not _TIME_PATTERN.fullmatch(normalized):
            raise ValueError("زمان باید با قالب HH:MM وارد شود")
        return normalized


class TaskPayload(WorkDatePayload):
    project_code: str = Field(min_length=1, max_length=50)
    subproject_code: str | None = Field(default=None, max_length=50)
    task_name: str = Field(min_length=1, max_length=250)
    start_time: str
    end_time: str

    @field_validator("project_code", mode="before")
    @classmethod
    def normalize_code(cls, value: object) -> object:
        return normalize_digits(value).upper() if isinstance(value, str) else value

    @field_validator("subproject_code", mode="before")
    @classmethod
    def normalize_subproject_code(cls, value: object) -> object:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        normalized = normalize_digits(value).upper()
        return normalized or None

    @field_validator("task_name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def validate_time(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = normalize_digits(value)
        if not _TIME_PATTERN.fullmatch(normalized):
            raise ValueError("زمان باید با قالب HH:MM وارد شود")
        return normalized


class DateRangePayload(BaseModel):
    start_date: str = Field(min_length=8, max_length=16)
    end_date: str = Field(min_length=8, max_length=16)

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def normalize_range_dates(cls, value: object) -> object:
        return normalize_jalali_date(value)

    @model_validator(mode="after")
    def validate_range(self) -> "DateRangePayload":
        if self.end_date < self.start_date:
            raise ValueError("تاریخ پایان باید بعد از تاریخ شروع باشد.")
        return self


class ProjectPayload(DateRangePayload):
    code: str = Field(min_length=1, max_length=50)
    title: str = Field(default="", max_length=250)
    user_ids: list[int] = Field(default_factory=list)

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, value: object) -> object:
        return normalize_digits(value).upper() if isinstance(value, str) else value

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("user_ids", mode="before")
    @classmethod
    def normalize_user_ids(cls, value: object) -> object:
        if value is None:
            return []
        if not isinstance(value, list):
            return value
        return sorted({int(item) for item in value})


class SubprojectPayload(DateRangePayload):
    code: str = Field(min_length=1, max_length=50)
    title: str = Field(default="", max_length=250)
    user_ids: list[int] = Field(default_factory=list)

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, value: object) -> object:
        return normalize_digits(value).upper() if isinstance(value, str) else value

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("user_ids", mode="before")
    @classmethod
    def normalize_user_ids(cls, value: object) -> object:
        if value is None:
            return []
        if not isinstance(value, list):
            return value
        return sorted({int(item) for item in value})
