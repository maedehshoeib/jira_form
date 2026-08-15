import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

export const PERSIAN_DATE_FORMAT = "YYYY/MM/DD";
export const TEHRAN_TIME_ZONE = "Asia/Tehran";

const BACKEND_DATETIME =
  /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::\d{1,2})?)?/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/;
const EXPLICIT_TIME_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const TEHRAN_PARTS = new Intl.DateTimeFormat("en-US-u-ca-gregory", {
  timeZone: TEHRAN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type TehranParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function toLatinDigits(value: string): string {
  return value.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (digit) => {
    const code = digit.charCodeAt(0);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    return String(code - 0x0660);
  });
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getTehranParts(date = new Date()): TehranParts {
  const parts = Object.fromEntries(
    TEHRAN_PARTS.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Record<keyof TehranParts, number>;

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

function jalaliDateFromGregorianParts(year: number, month: number, day: number): string {
  return toLatinDigits(
    new DateObject({
      date: `${year}/${pad2(month)}/${pad2(day)}`,
      format: PERSIAN_DATE_FORMAT,
    })
      .convert(persian, persian_fa)
      .format(PERSIAN_DATE_FORMAT)
  );
}

function tehranWallClockDate(date: Date): Date {
  const parts = getTehranParts(date);
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function formatAbsoluteDateTimeToTehran(date: Date): string {
  const parts = getTehranParts(date);
  return `${jalaliDateFromGregorianParts(parts.year, parts.month, parts.day)} ${pad2(
    parts.hour
  )}:${pad2(parts.minute)}`;
}

export function getTehranNowDate(): Date {
  return tehranWallClockDate(new Date());
}

export function getTehranTime(): string {
  const parts = getTehranParts();
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function parseTehranDateTime(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const trimmed = toLatinDigits(value.trim());
  const match = trimmed.match(BACKEND_DATETIME);

  if (match && !ISO_DATETIME.test(trimmed)) {
    const [, year, month, day, hour = "0", minute = "0"] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );
  }

  const parsed = new Date(
    ISO_DATETIME.test(trimmed) && !EXPLICIT_TIME_ZONE.test(trimmed)
      ? `${trimmed}Z`
      : trimmed
  );
  return Number.isNaN(parsed.getTime()) ? null : tehranWallClockDate(parsed);
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
  const parts = getTehranParts();
  return jalaliDateFromGregorianParts(parts.year, parts.month, parts.day);
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

/** Convert a Gregorian datetime (UTC ISO or Tehran backend format) to Jalali Tehran time. */
export function formatPersianDateTime(value: string | null | undefined): string {
  if (!value?.trim()) return "";

  try {
    const trimmed = toLatinDigits(value.trim());
    const match = trimmed.match(BACKEND_DATETIME);

    if (match && !ISO_DATETIME.test(trimmed)) {
      const [, year, month, day, hour = "0", minute = "0"] = match;
      return `${jalaliDateFromGregorianParts(
        Number(year),
        Number(month),
        Number(day)
      )} ${pad2(Number(hour))}:${pad2(Number(minute))}`;
    }

    const date = new Date(
      ISO_DATETIME.test(trimmed) && !EXPLICIT_TIME_ZONE.test(trimmed)
        ? `${trimmed}Z`
        : trimmed
    );
    if (Number.isNaN(date.getTime())) return value;
    return formatAbsoluteDateTimeToTehran(date);
  } catch {
    return value;
  }
}

/** Convert a Gregorian date value to Jalali YYYY/MM/DD in Tehran time. */
export function formatPersianDate(value: string | null | undefined): string {
  const formatted = formatPersianDateTime(value);
  if (!formatted) return "";
  return formatted.split(" ")[0] ?? formatted;
}
