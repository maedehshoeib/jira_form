from datetime import date
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, EmailStr, Field, computed_field, model_validator

from app.core.birthday import is_birthday_today

_PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def _parse_optional_date(value: object) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        normalized = value.strip().translate(_PERSIAN_DIGITS)
        if not normalized:
            return None
        return date.fromisoformat(normalized[:10])
    raise TypeError("Invalid birth date")


OptionalBirthDate = Annotated[date | None, BeforeValidator(_parse_optional_date)]


class LoginRequest(BaseModel):
    username: str
    password: str
    device_id: str = Field(default="", max_length=128)
    device_name: str = Field(default="", max_length=256)


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    email: str
    category: str
    department: str
    department_id: int | None = None
    job_title: str
    extension: str
    avatar_url: str
    birth_date: date | None = None
    must_change_password: bool
    is_admin: bool

    @computed_field
    @property
    def is_birthday(self) -> bool:
        return is_birthday_today(self.birth_date)

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ProfileUpdateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=256)
    email: EmailStr
    birth_date: OptionalBirthDate = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("تکرار رمز عبور با رمز عبور جدید یکسان نیست")
        if self.current_password == self.new_password:
            raise ValueError("رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد")
        return self
