import unittest
from datetime import date, datetime

from app.core.timezone import (
    format_tehran_datetime,
    format_tehran_iso,
    tehran_date_bounds_to_utc_naive,
)


class TehranTimezoneTests(unittest.TestCase):
    def test_formats_utc_naive_datetime_as_tehran(self):
        value = datetime(2026, 8, 15, 0, 0)
        self.assertEqual(format_tehran_datetime(value), "2026/08/15 03:30")
        self.assertEqual(format_tehran_iso(value), "2026-08-15T03:30:00+03:30")

    def test_tehran_day_bounds_are_utc_naive(self):
        start, end = tehran_date_bounds_to_utc_naive(
            date(2026, 8, 15),
            date(2026, 8, 15),
        )
        self.assertEqual(start, datetime(2026, 8, 14, 20, 30))
        self.assertEqual(end, datetime(2026, 8, 15, 20, 30))
        self.assertIsNone(start.tzinfo)
        self.assertIsNone(end.tzinfo)


if __name__ == "__main__":
    unittest.main()
