"""Application timezone helpers.

Database timestamps remain UTC-naive. Business dates and displayed datetimes
are consistently calculated in Iran/Tehran time.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import settings

UTC = timezone.utc


@lru_cache(maxsize=1)
def app_timezone():
    try:
        return ZoneInfo(settings.TIMESHEET_TIMEZONE)
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=3, minutes=30))


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def tehran_now() -> datetime:
    return datetime.now(app_timezone())


def tehran_today() -> date:
    return tehran_now().date()


def utc_naive_to_tehran(value: datetime) -> datetime:
    source = value.replace(tzinfo=UTC) if value.tzinfo is None else value
    return source.astimezone(app_timezone()).replace(tzinfo=None)


def format_tehran_datetime(value: datetime | None) -> str:
    if value is None:
        return ""
    return utc_naive_to_tehran(value).strftime("%Y/%m/%d %H:%M")


def format_tehran_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    source = value.replace(tzinfo=UTC) if value.tzinfo is None else value
    return source.astimezone(app_timezone()).isoformat()


def tehran_date_bounds_to_utc_naive(
    start_day: date, end_day: date
) -> tuple[datetime, datetime]:
    start = datetime.combine(start_day, time.min, tzinfo=app_timezone())
    end = datetime.combine(end_day + timedelta(days=1), time.min, tzinfo=app_timezone())
    return (
        start.astimezone(UTC).replace(tzinfo=None),
        end.astimezone(UTC).replace(tzinfo=None),
    )
