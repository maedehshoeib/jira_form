import { FormEvent, useEffect, useMemo, useState } from "react";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, MapPin,
  Menu, Plus, Search, Trash2, UserRound, X,
} from "lucide-react";

import client from "../api/client";
import { endpoints } from "../api/endpoints";
import AppShell from "../components/layout/AppShell";
import { useAuth } from "../context/AuthContext";
import { getTodayPersian, toLatinDigits } from "../lib/persianDate";
import { cn } from "../lib/utils";

type CalendarEvent = {
  id: number; title: string; description: string; location: string;
  jalali_date: string; start_time: string; end_time: string; color: string;
  user_id: number; user_name: string; created_by_id: number; created_by_name: string;
};

type CalendarUser = { id: number; display_name: string; username: string };
type EventForm = Omit<CalendarEvent, "id" | "user_name" | "created_by_id" | "created_by_name">;
type ViewMode = "day" | "week" | "month" | "year";

const weekDays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const colors = ["#2563eb", "#7c3aed", "#db2777", "#dc2626", "#059669", "#d97706"];

const blankForm = (date: string, userId: number): EventForm => ({
  title: "", description: "", location: "", jalali_date: date,
  start_time: "09:00", end_time: "10:00", color: colors[0], user_id: userId,
});

function dateKey(date: DateObject) {
  return toLatinDigits(date.format("YYYY/MM/DD"));
}

function calendarMonthCells(date: DateObject) {
  const first = new DateObject({
    date: `${date.year}/${date.month.number}/1`, calendar: persian, locale: persianFa,
  });
  return Array.from({ length: 42 }, (_, index) => new DateObject(first).add(index - first.weekDay.index, "day"));
}

function timeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function getError(error: unknown) {
  const value = error as { response?: { data?: { detail?: string | Array<{ msg: string }> } } };
  const detail = value.response?.data?.detail;
  if (Array.isArray(detail)) return detail[0]?.msg || "اطلاعات واردشده معتبر نیست.";
  if (detail) return detail;
  if (error instanceof Error && error.message) return error.message;
  return "ارتباط با سرور برقرار نشد.";
}

export default function MyCalendarPage() {
  const { user } = useAuth();
  const today = getTodayPersian();
  const [viewDate, setViewDate] = useState(() => new DateObject({ calendar: persian, locale: persianFa }));
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [users, setUsers] = useState<CalendarUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | "all">(user?.is_admin ? "all" : user?.id || 0);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(() => blankForm(today, user?.id || 0));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [eventResponse, userResponse] = await Promise.all([
        client.get<CalendarEvent[]>(endpoints.calendarEvents),
        client.get<CalendarUser[]>(endpoints.calendarUsers),
      ]);
      if (!Array.isArray(eventResponse.data) || !Array.isArray(userResponse.data)) {
        throw new Error("سرویس تقویم هنوز فعال نشده است. لطفاً سرور برنامه را یک‌بار راه‌اندازی مجدد کنید.");
      }
      setEvents(eventResponse.data);
      setUsers(userResponse.data);
      if (!user?.is_admin) {
        void client.post(endpoints.calendarNotificationsRead)
          .then(() => window.dispatchEvent(new Event("calendar:refresh-notifications")))
          .catch(() => undefined);
      }
      if (!form.user_id && userResponse.data[0]) {
        setForm((current) => ({ ...current, user_id: userResponse.data[0].id }));
      }
    } catch (reason) {
      setEvents([]);
      setUsers([]);
      setError(getError(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const monthCells = useMemo(() => calendarMonthCells(viewDate), [viewDate]);
  const weekCells = useMemo(() => {
    const start = new DateObject(viewDate).subtract(viewDate.weekDay.index, "day");
    return Array.from({ length: 7 }, (_, index) => new DateObject(start).add(index, "day"));
  }, [viewDate]);

  const visibleEvents = useMemo(() => events.filter((event) => {
    const matchesUser = selectedUser === "all" || event.user_id === selectedUser;
    const text = `${event.title} ${event.description} ${event.location} ${event.user_name}`.toLowerCase();
    return matchesUser && text.includes(query.trim().toLowerCase());
  }), [events, query, selectedUser]);

  const openCreate = (date = today) => {
    const fallbackUser = selectedUser === "all" ? (users[0]?.id || user?.id || 0) : selectedUser;
    setEditingId(null);
    setForm(blankForm(date, fallbackUser));
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditingId(event.id);
    setForm({
      title: event.title, description: event.description, location: event.location,
      jalali_date: event.jalali_date, start_time: event.start_time,
      end_time: event.end_time, color: event.color, user_id: event.user_id,
    });
    setError("");
    setDialogOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const payload = { ...form, user_id: user?.is_admin ? form.user_id : user?.id };
      if (editingId) await client.put(`${endpoints.calendarEvents}/${editingId}`, payload);
      else await client.post(endpoints.calendarEvents, payload);
      setDialogOpen(false);
      await load();
    } catch (reason) {
      setError(getError(reason));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editingId || !window.confirm("این رویداد حذف شود؟")) return;
    setSaving(true);
    try {
      await client.delete(`${endpoints.calendarEvents}/${editingId}`);
      setDialogOpen(false);
      await load();
    } catch (reason) {
      setError(getError(reason));
    } finally {
      setSaving(false);
    }
  };

  const moveView = (amount: number) => {
    const unit = viewMode === "day" ? "day" : viewMode === "week" ? "day" : viewMode === "year" ? "year" : "month";
    setViewDate(new DateObject(viewDate).add(viewMode === "week" ? amount * 7 : amount, unit));
  };
  const moveCalendarMonth = (amount: number) => setViewDate(new DateObject(viewDate).add(amount, "month"));
  const viewTitle = viewMode === "day"
    ? viewDate.format("dddd DD MMMM YYYY")
    : viewMode === "week"
      ? `${weekCells[0].format("DD MMMM")} تا ${weekCells[6].format("DD MMMM YYYY")}`
      : viewMode === "year" ? viewDate.format("YYYY") : viewDate.format("MMMM YYYY");
  const goToday = () => setViewDate(new DateObject({ calendar: persian, locale: persianFa }));

  const renderEvent = (item: CalendarEvent, compact = false) => (
    <div key={item.id} onClick={(event) => { event.stopPropagation(); openEdit(item); }}
      className={cn("cursor-pointer overflow-hidden rounded border-r-4 bg-blue-50 px-2 py-1 text-xs text-slate-800 shadow-sm hover:brightness-95 dark:bg-slate-800 dark:text-slate-100", compact && "truncate")}
      style={{ borderRightColor: item.color }} title={`${item.start_time} ${item.title}`}>
      <span className="ml-1 text-slate-500">{item.start_time}</span><strong>{item.title}</strong>
      {user?.is_admin && <span className="mr-1 text-[10px] text-slate-500">· {item.user_name}</span>}
    </div>
  );

  const renderMonthView = () => (
    <div className="grid min-w-[700px] grid-cols-7 border-r border-slate-200 dark:border-slate-800">
      {weekDays.map((day) => <div key={day} className="border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">{day}</div>)}
      {monthCells.map((day) => {
        const key = dateKey(day);
        const dayEvents = visibleEvents.filter((item) => item.jalali_date === key);
        const currentMonth = day.month.number === viewDate.month.number;
        return <button key={key} onClick={() => openCreate(key)} className={cn("group min-h-28 border-b border-l border-slate-200 p-1.5 text-right align-top hover:bg-blue-50/50 dark:border-slate-800 dark:hover:bg-blue-950/20", !currentMonth && "bg-slate-50/70 dark:bg-slate-900/40")}>
          <span className={cn("mb-1 inline-grid h-7 w-7 place-items-center rounded-full text-sm", !currentMonth && "text-slate-400", key === today && "bg-blue-600 font-bold text-white")}>{day.day.toLocaleString("fa-IR")}</span>
          <div className="space-y-1">{dayEvents.slice(0, 4).map((item) => renderEvent(item, true))}{dayEvents.length > 4 && <div className="px-1 text-xs text-blue-600">{(dayEvents.length - 4).toLocaleString("fa-IR")} مورد دیگر</div>}</div>
        </button>;
      })}
    </div>
  );

  const renderTimeGrid = (days: DateObject[]) => (
    <div className="max-h-[calc(100vh-13rem)] overflow-auto">
      <div className="sticky top-0 z-20 grid border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(9rem, 1fr))` }}>
        <div />{days.map((day) => <button key={`head-${dateKey(day)}`} onClick={() => setViewDate(new DateObject(day))} className="border-r border-slate-200 px-2 py-3 text-center dark:border-slate-800"><span className="block text-xs text-slate-500">{day.weekDay.name}</span><span className={cn("mx-auto mt-1 grid h-9 w-9 place-items-center rounded-full text-lg", dateKey(day) === today && "bg-blue-600 font-bold text-white")}>{day.day.toLocaleString("fa-IR")}</span></button>)}</div>
      <div className="grid" style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(9rem, 1fr))` }}>
        <div className="relative h-[1152px] border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="absolute left-2 -translate-y-1/2 text-[10px] text-slate-400" style={{ top: hour * 48 }}>{`${String(hour).padStart(2, "0")}:00`}</span>)}</div>
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = visibleEvents.filter((item) => item.jalali_date === key);
          return <button key={`time-${key}`} onClick={() => openCreate(key)} className="relative h-[1152px] border-l border-slate-200 text-right dark:border-slate-800" style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 47px, rgba(148,163,184,.28) 48px)" }}>
            {dayEvents.map((item) => { const top = timeMinutes(item.start_time) * 0.8; const height = Math.max(28, (timeMinutes(item.end_time) - timeMinutes(item.start_time)) * 0.8); return <div key={item.id} onClick={(event) => { event.stopPropagation(); openEdit(item); }} className="absolute inset-x-1 z-10 overflow-hidden rounded border-r-4 bg-blue-100 p-1.5 text-xs text-slate-800 shadow-sm dark:bg-blue-950 dark:text-blue-50" style={{ top, height, borderRightColor: item.color }}><strong className="block truncate">{item.title}</strong><span>{item.start_time}–{item.end_time}</span>{user?.is_admin && <span className="block truncate opacity-70">{item.user_name}</span>}</div>; })}
          </button>;
        })}
      </div>
    </div>
  );

  const renderYearView = () => (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, index) => new DateObject({ date: `${viewDate.year}/${index + 1}/1`, calendar: persian, locale: persianFa })).map((month) => {
        const cells = calendarMonthCells(month);
        return <section key={month.month.number} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><button onClick={() => { setViewDate(new DateObject(month)); setViewMode("month"); }} className="mb-3 font-bold text-blue-700">{month.format("MMMM")}</button><div className="grid grid-cols-7 text-center text-[10px] text-slate-400">{weekDays.map((day) => <span key={day}>{day[0]}</span>)}</div><div className="mt-1 grid grid-cols-7 gap-y-1 text-center text-xs">{cells.map((day) => { const key = dateKey(day); const hasEvent = visibleEvents.some((item) => item.jalali_date === key); return <button key={key} onClick={() => { setViewDate(new DateObject(day)); setViewMode("day"); }} className={cn("relative mx-auto h-7 w-7 rounded-full hover:bg-blue-100", day.month.number !== month.month.number && "text-slate-300", key === today && "bg-blue-600 font-bold text-white")}><span>{day.day.toLocaleString("fa-IR")}</span>{hasEvent && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-600" />}</button>; })}</div></section>;
      })}
    </div>
  );

  return (
    <AppShell>
      <div dir="rtl" className="-m-4 min-h-[calc(100vh-5rem)] overflow-hidden bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:-m-6 lg:-m-6">
        <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-950">
          <button className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="منوی تقویم"><Menu size={20} /></button>
          <div className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="text-blue-600" />تقویم من</div>
          <button onClick={() => openCreate()} className="mr-2 flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
            <Plus size={18} /> رویداد جدید
          </button>
          <div className="relative mr-auto w-full sm:w-72">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={17} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجو در تقویم" className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-3 pr-10 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-9rem)]">
          <aside className="hidden w-64 shrink-0 border-l border-slate-200 bg-[#fafafa] p-4 dark:border-slate-800 dark:bg-slate-900/60 lg:block">
            <div className="mb-5 flex items-center justify-between">
              <span className="font-bold">{viewDate.format("MMMM YYYY")}</span>
              <div className="flex"><button onClick={() => moveCalendarMonth(-1)} className="p-1.5 hover:bg-slate-200"><ChevronRight size={17} /></button><button onClick={() => moveCalendarMonth(1)} className="p-1.5 hover:bg-slate-200"><ChevronLeft size={17} /></button></div>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] text-slate-500">{weekDays.map((day) => <span key={day}>{day[0]}</span>)}</div>
            <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-xs">
              {monthCells.map((day) => <button key={`mini-${dateKey(day)}`} onClick={() => setViewDate(new DateObject(day))} className={cn("mx-auto h-7 w-7 rounded-full hover:bg-blue-100", dateKey(day) === today && "bg-blue-600 font-bold text-white", day.month.number !== viewDate.month.number && "text-slate-300")}>{day.day.toLocaleString("fa-IR")}</button>)}
            </div>
            <div className="my-5 border-t border-slate-200 dark:border-slate-700" />
            <p className="mb-3 text-sm font-bold">تقویم‌ها</p>
            {user?.is_admin ? (
              <div className="space-y-1">
                <button onClick={() => setSelectedUser("all")} className={cn("flex w-full items-center gap-2 rounded px-2 py-2 text-sm", selectedUser === "all" && "bg-blue-100 text-blue-700")}><span className="h-3 w-3 rounded-sm bg-blue-600" />همه کاربران</button>
                {users.map((item, index) => <button key={item.id} onClick={() => setSelectedUser(item.id)} className={cn("flex w-full items-center gap-2 rounded px-2 py-2 text-right text-sm hover:bg-slate-100 dark:hover:bg-slate-800", selectedUser === item.id && "bg-blue-100 text-blue-700")}><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: colors[index % colors.length] }} />{item.display_name || item.username}</button>)}
              </div>
            ) : <div className="flex items-center gap-2 rounded bg-blue-50 px-2 py-2 text-sm text-blue-700"><span className="h-3 w-3 rounded-sm bg-blue-600" />تقویم شخصی من</div>}
          </aside>

          <main className="min-w-0 flex-1">
            <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
              <button onClick={goToday} className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">امروز</button>
              <button onClick={() => moveView(-1)} className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight size={20} /></button>
              <button onClick={() => moveView(1)} className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft size={20} /></button>
              <h1 className="mr-2 hidden text-lg font-semibold sm:block">{viewTitle}</h1>
              <div className="mr-auto flex rounded-md bg-slate-100 p-1 text-xs dark:bg-slate-800">
                {([['day','روز'],['week','هفته'],['month','ماه'],['year','سال']] as Array<[ViewMode,string]>).map(([mode,label]) => <button key={mode} onClick={() => setViewMode(mode)} className={cn("rounded px-3 py-1.5 font-semibold transition", viewMode === mode && "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-200")}>{label}</button>)}
              </div>
            </div>
            {error && !dialogOpen && (
              <div className="m-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <CalendarDays className="mt-0.5 shrink-0" size={19} />
                <div><p className="font-bold">تقویم بارگذاری نشد</p><p className="mt-1">{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded bg-amber-900 px-3 py-1.5 font-bold text-white">تلاش دوباره</button></div>
              </div>
            )}
            {loading ? <div className="grid h-96 place-items-center text-slate-500">در حال بارگذاری تقویم...</div> : viewMode === "month" ? renderMonthView() : viewMode === "year" ? renderYearView() : renderTimeGrid(viewMode === "week" ? weekCells : [viewDate])}
          </main>
        </div>

        {dialogOpen && <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/35" onMouseDown={() => setDialogOpen(false)}>
          <form onSubmit={save} onMouseDown={(e) => e.stopPropagation()} className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-slate-950">
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <button type="button" onClick={() => setDialogOpen(false)} className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
              <h2 className="font-bold">{editingId ? "ویرایش رویداد" : "رویداد جدید"}</h2>
              <div className="mr-auto flex gap-2">{editingId && <button type="button" onClick={remove} disabled={saving} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 size={19} /></button>}<button disabled={saving} className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700"><Check size={17} />{saving ? "در حال ذخیره" : "ذخیره"}</button></div>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <input autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="افزودن عنوان" className="w-full border-0 border-b-2 border-blue-600 bg-transparent px-1 py-3 text-2xl font-semibold outline-none" />
              {user?.is_admin && <label className="flex items-center gap-3"><UserRound className="text-slate-400" size={20} /><select required value={form.user_id} onChange={(e) => setForm({ ...form, user_id: Number(e.target.value) })} className="flex-1 rounded border border-slate-300 bg-transparent px-3 py-2.5 dark:border-slate-700"><option value="">انتخاب کاربر</option>{users.map((item) => <option key={item.id} value={item.id}>{item.display_name || item.username}</option>)}</select></label>}
              <div className="flex items-center gap-3"><CalendarDays className="text-slate-400" size={20} /><input required dir="ltr" value={form.jalali_date} onChange={(e) => setForm({ ...form, jalali_date: toLatinDigits(e.target.value) })} placeholder="1405/06/01" className="flex-1 rounded border border-slate-300 bg-transparent px-3 py-2.5 text-right dark:border-slate-700" /></div>
              <div className="flex items-center gap-3"><Clock3 className="text-slate-400" size={20} /><input required type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="rounded border border-slate-300 bg-transparent px-3 py-2.5 dark:border-slate-700" /><span>تا</span><input required type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="rounded border border-slate-300 bg-transparent px-3 py-2.5 dark:border-slate-700" /></div>
              <div className="flex items-center gap-3"><MapPin className="text-slate-400" size={20} /><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="افزودن مکان" className="flex-1 rounded border border-slate-300 bg-transparent px-3 py-2.5 dark:border-slate-700" /></div>
              <textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="توضیحات رویداد" className="w-full resize-none rounded border border-slate-300 bg-transparent p-3 dark:border-slate-700" />
              <div><p className="mb-2 text-sm text-slate-500">رنگ رویداد</p><div className="flex gap-3">{colors.map((color) => <button key={color} type="button" onClick={() => setForm({ ...form, color })} className={cn("h-7 w-7 rounded-full", form.color === color && "ring-2 ring-offset-2")} style={{ backgroundColor: color }} aria-label={`رنگ ${color}`} />)}</div></div>
              {editingId && events.find((item) => item.id === editingId)?.created_by_id !== user?.id && <p className="rounded bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900">این زمان توسط مدیر برنامه‌ریزی شده است.</p>}
            </div>
          </form>
        </div>}
      </div>
    </AppShell>
  );
}
