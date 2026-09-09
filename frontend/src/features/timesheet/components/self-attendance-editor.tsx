import { useState } from "react";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import { Clock3, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  createMyAttendance,
  deleteMyAttendance,
  updateMyAttendance,
  type AttendanceSegment,
} from "@/features/timesheet/api";
import { JalaliDateTimePicker } from "@/features/timesheet/components/jalali-date-time-picker";
import { getTodayPersian, toLatinDigits } from "@/lib/persianDate";

function parseJalali(value?: string | null): DateObject | null {
  if (!value) return null;
  return new DateObject({
    date: value,
    format: "YYYY/MM/DD",
    calendar: persian,
    locale: persianFa,
  });
}

function parseTime(value?: string | null): DateObject | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return new DateObject({
    calendar: persian,
    locale: persianFa,
  }).set({ hour, minute, second: 0, millisecond: 0 });
}

function asDate(value: DateObject): string {
  return toLatinDigits(value.format("YYYY/MM/DD"));
}

function asTime(value: DateObject): string {
  return toLatinDigits(value.format("HH:mm"));
}

type SelfAttendanceEditorProps = {
  attendance: AttendanceSegment[];
  formatMinutes: (minutes: number) => string;
  segmentMinutes: (start: string, end: string | null) => number;
  onChanged: (workDate?: string) => Promise<void>;
  onError: (message: string) => void;
  onStatus: (message: string) => void;
};

export function SelfAttendanceEditor({
  attendance,
  formatMinutes,
  segmentMinutes,
  onChanged,
  onError,
  onStatus,
}: SelfAttendanceEditorProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [workDate, setWorkDate] = useState<DateObject | null>(
    parseJalali(getTodayPersian()),
  );
  const [checkIn, setCheckIn] = useState<DateObject | null>(null);
  const [checkOut, setCheckOut] = useState<DateObject | null>(null);
  const [busy, setBusy] = useState(false);

  const closeEditor = () => {
    setOpen(false);
    setEditingId(null);
    setCheckIn(null);
    setCheckOut(null);
  };

  const openCreate = () => {
    setEditingId(null);
    setWorkDate(parseJalali(getTodayPersian()));
    setCheckIn(null);
    setCheckOut(null);
    setOpen(true);
  };

  const openEdit = (row: AttendanceSegment) => {
    setEditingId(row.id);
    setWorkDate(parseJalali(row.work_date));
    setCheckIn(parseTime(row.check_in_time));
    setCheckOut(parseTime(row.check_out_time));
    setOpen(true);
  };

  const save = async () => {
    if (!workDate || !checkIn) {
      onError("تاریخ و ساعت ورود را مشخص کنید.");
      return;
    }
    const checkInTime = asTime(checkIn);
    const checkOutTime = checkOut ? asTime(checkOut) : null;
    if (checkOutTime && checkOutTime <= checkInTime) {
      onError("ساعت خروج باید بعد از ساعت ورود باشد.");
      return;
    }
    const workDateValue = asDate(workDate);
    if (!checkOutTime && workDateValue !== toLatinDigits(getTodayPersian())) {
      onError("برای روزهای دیگر باید ساعت خروج را هم وارد کنید.");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const payload = {
        work_date: workDateValue,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
      };
      if (editingId) {
        await updateMyAttendance(editingId, payload);
        onStatus("ورود و خروج با موفقیت ویرایش شد.");
      } else {
        await createMyAttendance(payload);
        onStatus("ورود و خروج با موفقیت ثبت شد.");
      }
      closeEditor();
      await onChanged(workDateValue);
    } catch (error) {
      const candidate = error as { response?: { data?: { detail?: unknown } } };
      const detail = candidate.response?.data?.detail;
      onError(
        typeof detail === "string"
          ? detail
          : "ذخیره ورود و خروج با خطا روبه‌رو شد.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: AttendanceSegment) => {
    if (
      !window.confirm(
        `تردد ${row.work_date} از ${row.check_in_time} حذف شود؟`,
      )
    ) {
      return;
    }
    onError("");
    try {
      await deleteMyAttendance(row.id);
      onStatus("تردد حذف شد.");
      if (editingId === row.id) closeEditor();
      await onChanged(toLatinDigits(row.work_date));
    } catch (error) {
      const candidate = error as { response?: { data?: { detail?: unknown } } };
      const detail = candidate.response?.data?.detail;
      onError(
        typeof detail === "string" ? detail : "حذف تردد با خطا روبه‌رو شد.",
      );
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Clock3 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-foreground">
              ورود و خروج من
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ترددهای این بازه را ثبت، اصلاح یا حذف کنید.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="gap-2 bg-sky-600 text-white hover:bg-sky-700"
        >
          <Plus className="h-4 w-4" />
          ثبت ورود / خروج
        </Button>
      </div>

      {attendance.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
          در این بازه ترددی ثبت نشده است. می‌توانید ورود و خروج را به‌صورت دستی
          وارد کنید.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {attendance.map((row) => (
            <article
              key={row.id}
              className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
            >
              <div>
                <p className="text-sm font-bold text-foreground">
                  {row.work_date}
                </p>
                <p className="mt-1 font-mono text-sm text-muted-foreground" dir="ltr">
                  {row.check_in_time} — {row.check_out_time || "باز"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatMinutes(
                    segmentMinutes(row.check_in_time, row.check_out_time),
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(row)}
                  className="gap-1"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  ویرایش
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void remove(row)}
                  className="gap-1 text-rose-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={closeEditor}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? "ویرایش ورود و خروج" : "ثبت ورود و خروج"}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl dark:bg-slate-900"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-lg font-black text-foreground">
                  {editingId ? "ویرایش ورود و خروج" : "ثبت ورود / خروج"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  ساعت‌ها را برای همان روز کاری وارد کنید. برای روزهای دیگر ورود و
                  خروج هر دو لازم است.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={closeEditor}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
              <Label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  تاریخ
                </span>
                <JalaliDateTimePicker
                  value={workDate}
                  onChange={(value) =>
                    setWorkDate(Array.isArray(value) ? value[0] : value)
                  }
                  format="YYYY/MM/DD"
                  placeholder="تاریخ تردد"
                />
              </Label>
              <Label>
                <span className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  ساعت ورود
                </span>
                <JalaliDateTimePicker
                  value={checkIn}
                  onChange={(value) =>
                    setCheckIn(Array.isArray(value) ? value[0] : value)
                  }
                  disableDayPicker
                  format="HH:mm"
                  placeholder="--:--"
                />
              </Label>
              <Label>
                <span className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  ساعت خروج
                </span>
                <JalaliDateTimePicker
                  value={checkOut}
                  onChange={(value) =>
                    setCheckOut(Array.isArray(value) ? value[0] : value)
                  }
                  disableDayPicker
                  format="HH:mm"
                  placeholder="باز بماند"
                />
              </Label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
              {checkOut && (
                <Button variant="outline" onClick={() => setCheckOut(null)}>
                  پاک کردن خروج
                </Button>
              )}
              <Button variant="outline" onClick={closeEditor}>
                انصراف
              </Button>
              <Button
                onClick={() => void save()}
                disabled={busy}
                className="gap-2 bg-sky-600 text-white hover:bg-sky-700"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock3 className="h-4 w-4" />
                )}
                {editingId ? "ذخیره تردد" : "ثبت تردد"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
