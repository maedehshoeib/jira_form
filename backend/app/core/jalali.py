"""Jalali calendar helpers used by analytics and timesheet reporting."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from app.core.timezone import tehran_date_bounds_to_utc_naive, tehran_today


def normalize_digits(value: str) -> str:
    """Convert Persian/Arabic digits to ASCII digits."""
    translation = str.maketrans(
        "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩",
        "01234567890123456789",
    )
    return value.translate(translation).strip()


def gregorian_to_jalali(value: date) -> str:
    """Convert a Gregorian date to YYYY/MM/DD in the Jalali calendar."""
    gy, gm, gd = value.year, value.month, value.day
    gregorian_days = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

    adjusted_year = gy + 1 if gm > 2 else gy
    days = (
        355666
        + 365 * gy
        + (adjusted_year + 3) // 4
        - (adjusted_year + 99) // 100
        + (adjusted_year + 399) // 400
        + gd
        + gregorian_days[gm - 1]
    )

    jy = -1595 + 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm = 1 + days // 31
        jd = 1 + days % 31
    else:
        jm = 7 + (days - 186) // 30
        jd = 1 + (days - 186) % 30
    return f"{jy:04d}/{jm:02d}/{jd:02d}"


def jalali_to_gregorian(value: str) -> date:
    """Convert a Jalali YYYY/MM/DD string to a Gregorian date."""
    normalized = normalize_digits(value).replace("-", "/")
    parts = normalized.split("/")
    if len(parts) != 3:
        raise ValueError("تاریخ شمسی باید به صورت YYYY/MM/DD باشد.")
    jy, jm, jd = (int(part) for part in parts)

    jy += 1595
    days = -355668 + (365 * jy) + (jy // 33) * 8 + ((jy % 33) + 3) // 4 + jd
    if jm < 7:
        days += (jm - 1) * 31
    else:
        days += ((jm - 7) * 30) + 186

    gy = 400 * (days // 146097)
    days %= 146097
    if days > 36524:
        days -= 1
        gy += 100 * (days // 36524)
        days %= 36524
        if days >= 365:
            days += 1

    gy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        gy += (days - 1) // 365
        days = (days - 1) % 365

    days_in_month = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if (gy % 4 == 0 and gy % 100 != 0) or (gy % 400 == 0):
        days_in_month[2] = 29

    gm = 1
    while gm < 13 and days >= days_in_month[gm]:
        days -= days_in_month[gm]
        gm += 1
    return date(gy, gm, days + 1)


def jalali_today() -> str:
    return gregorian_to_jalali(tehran_today())


def default_analytics_range(days: int = 6) -> tuple[str, str]:
    """Return inclusive Jalali start/end covering today and the previous N days."""
    end = tehran_today()
    start = end - timedelta(days=days)
    return gregorian_to_jalali(start), gregorian_to_jalali(end)


def jalali_range_to_datetimes(start_date: str, end_date: str) -> tuple[datetime, datetime]:
    """Convert inclusive Jalali dates to UTC-naive datetimes for SQL filtering."""
    return tehran_date_bounds_to_utc_naive(
        jalali_to_gregorian(start_date),
        jalali_to_gregorian(end_date),
    )
