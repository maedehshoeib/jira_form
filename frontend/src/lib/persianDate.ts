import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

const BACKEND_DATETIME = /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/;

export function formatPersianDateTime(value: string): string {
  if (!value.trim()) return "";

  try {
    const match = value.trim().match(BACKEND_DATETIME);
    if (!match) return value;

    const [, year, month, day, hour, minute] = match.map(Number);
    const localDate = new Date(year, month - 1, day, hour, minute);

    return new DateObject(localDate)
      .convert(persian, persian_fa)
      .format("YYYY/MM/DD HH:mm");
  } catch {
    return value;
  }
}