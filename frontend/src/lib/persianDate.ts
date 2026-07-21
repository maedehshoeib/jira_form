import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

export const PERSIAN_DATE_FORMAT = "YYYY/MM/DD";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
}

export function normalizePersianDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return toLatinDigits(value.trim());
  if (
    typeof value === "object" &&
    value !== null &&
    "format" in value &&
    typeof (value as { format: (pattern: string) => string }).format === "function"
  ) {
    return toLatinDigits(
      (value as { format: (pattern: string) => string }).format(PERSIAN_DATE_FORMAT)
    );
  }
  return toLatinDigits(String(value).trim());
}

export function parsePersianDate(persianDate: string): DateObject | null {
  const normalized = normalizePersianDate(persianDate);
  if (!normalized) return null;
  try {
    return new DateObject({
      date: normalized,
      format: PERSIAN_DATE_FORMAT,
      calendar: persian,
    });
  } catch {
    return null;
  }
}

export function getTodayPersian(): string {
  return new DateObject({ calendar: persian }).format(PERSIAN_DATE_FORMAT);
}

export function addOneYearAndOneDay(persianDate: string): string {
  const date = parsePersianDate(persianDate);
  if (!date) return "";
  return date.add(1, "year").add(1, "day").format(PERSIAN_DATE_FORMAT);
}

export function isPersianDateAfter(date: string, reference: string): boolean {
  const a = parsePersianDate(date);
  const b = parsePersianDate(reference);
  if (!a || !b) return false;
  return a.toUnix() > b.toUnix();
}

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