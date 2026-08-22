from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.jalali import gregorian_to_jalali, jalali_to_gregorian, normalize_digits


class CalendarEventPayload(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    description: str = Field(default="", max_length=4000)
    location: str = Field(default="", max_length=256)
    jalali_date: str
    start_time: str
    end_time: str
    color: str = "#2563eb"
    user_id: int | None = None

    @field_validator("title", "description", "location")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("jalali_date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        value = normalize_digits(value).replace("-", "/")
        if gregorian_to_jalali(jalali_to_gregorian(value)) != value:
            raise ValueError("Invalid Jalali date.")
        return value

    @field_validator("start_time", "end_time")
    @classmethod
    def valid_time(cls, value: str) -> str:
        value = normalize_digits(value)
        try:
            hour, minute = (int(part) for part in value.split(":"))
            if len(value) != 5 or not 0 <= hour <= 23 or not 0 <= minute <= 59:
                raise ValueError
        except ValueError:
            raise ValueError("Time must use HH:MM.")
        return value

    @field_validator("color")
    @classmethod
    def valid_color(cls, value: str) -> str:
        if len(value) != 7 or value[0] != "#":
            raise ValueError("Invalid event color.")
        int(value[1:], 16)
        return value.lower()

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_time <= self.start_time:
            raise ValueError("End time must be after start time.")
        return self


class CalendarEventResponse(BaseModel):
    id: int
    title: str
    description: str
    location: str
    jalali_date: str
    start_time: str
    end_time: str
    color: str
    user_id: int
    user_name: str
    created_by_id: int
    created_by_name: str
    created_at: datetime
    updated_at: datetime


class CalendarUserResponse(BaseModel):
    id: int
    display_name: str
    username: str
