import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";

import { toLatinDigits } from "@/lib/persianDate";

import { EVENT_COLORS, type CalendarEvent, type EventForm } from "../types";

export function dateKey(date: DateObject) {
  return toLatinDigits(date.format("YYYY/MM/DD"));
}

export function calendarMonthCells(date: DateObject) {
  const first = new DateObject({
    date: `${date.year}/${date.month.number}/1`,
    calendar: persian,
    locale: persianFa,
  });
  return Array.from(
    { length: 42 },
    (_, index) => new DateObject(first).add(index - first.weekDay.index, "day"),
  );
}

export function timeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function blankForm(date: string, userIds: number[]): EventForm {
  return {
    title: "",
    description: "",
    location: "",
    jalali_date: date,
    start_time: "09:00",
    end_time: "10:00",
    color: EVENT_COLORS[0],
    user_ids: userIds,
  };
}

export function getError(error: unknown) {
  const value = error as {
    response?: { data?: { detail?: string | Array<{ msg: string }> } };
  };
  const detail = value.response?.data?.detail;
  if (Array.isArray(detail)) return detail[0]?.msg || "اطلاعات واردشده معتبر نیست.";
  if (detail) return detail;
  if (error instanceof Error && error.message) return error.message;
  return "ارتباط با سرور برقرار نشد.";
}

export type LaidOutEvent = CalendarEvent & {
  top: number;
  height: number;
  column: number;
  columnCount: number;
};

/** Pack overlapping timed events into side-by-side columns. */
export function layoutDayEvents(events: CalendarEvent[]): LaidOutEvent[] {
  const sorted = [...events].sort(
    (a, b) =>
      timeMinutes(a.start_time) - timeMinutes(b.start_time) ||
      timeMinutes(b.end_time) - timeMinutes(a.end_time),
  );
  const active: Array<{ end: number; column: number }> = [];
  const placed: LaidOutEvent[] = [];
  let cluster: LaidOutEvent[] = [];
  let clusterMaxCol = 0;

  const flushCluster = () => {
    const count = clusterMaxCol + 1;
    for (const item of cluster) item.columnCount = count;
    cluster = [];
    clusterMaxCol = 0;
  };

  for (const event of sorted) {
    const start = timeMinutes(event.start_time);
    const end = timeMinutes(event.end_time);
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i].end <= start) active.splice(i, 1);
    }
    if (active.length === 0 && cluster.length) flushCluster();

    const used = new Set(active.map((item) => item.column));
    let column = 0;
    while (used.has(column)) column += 1;
    active.push({ end, column });
    clusterMaxCol = Math.max(clusterMaxCol, column);

    const laid: LaidOutEvent = {
      ...event,
      top: start * 0.8,
      height: Math.max(24, (end - start) * 0.8),
      column,
      columnCount: 1,
    };
    cluster.push(laid);
    placed.push(laid);
  }
  flushCluster();
  return placed;
}

export function colorTint(hex: string, alpha = 0.14) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
