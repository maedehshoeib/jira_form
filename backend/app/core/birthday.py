from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import settings


@lru_cache(maxsize=1)
def _app_timezone():
    try:
        return ZoneInfo(settings.TIMESHEET_TIMEZONE)
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=3, minutes=30))


def is_birthday_today(birth_date: date | None) -> bool:
    if birth_date is None:
        return False
    today = datetime.now(_app_timezone()).date()
    return birth_date.month == today.month and birth_date.day == today.day


def user_display_name(user) -> str:
    name = (getattr(user, "display_name", None) or getattr(user, "username", "") or "").strip()
    if name and is_birthday_today(getattr(user, "birth_date", None)):
        return f"{name} 🎂"
    return name
