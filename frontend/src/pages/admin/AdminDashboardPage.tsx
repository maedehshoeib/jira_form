import { Fragment, useEffect, useMemo, useState } from "react";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Eye,
  EyeOff,
  Hash,
  Loader2,
  Mail,
  MailCheck,
  MonitorSmartphone,
  Search,
  Send,
  Target,
  TimerReset,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import AppShell from "../../components/layout/AppShell";
import {
  fetchAdminAnalytics,
  type AnalyticsProjectStatus,
  type AnalyticsResponse,
  type ChartItem,
  type DailyTimesheetPoint,
} from "../../features/admin/analytics";
import { JalaliDateTimePicker } from "../../features/timesheet/components/jalali-date-time-picker";
import { formatPersianDate, formatPersianDateTime, getTodayPersian } from "../../lib/persianDate";

type AnalyticsTab = "overview" | "employees" | "projects" | "departments" | "forms" | "letters";
type PeriodPreset = "today" | "week" | "month" | "custom";
type ProjectStatusFilter = "all" | AnalyticsProjectStatus;
type EmployeeSortKey =
  | "full_name"
  | "department"
  | "active_days"
  | "attendance_minutes"
  | "task_minutes"
  | "task_count"
  | "form_count"
  | "efficiency_percent";
type DepartmentSortKey =
  | "name"
  | "employee_count"
  | "active_employees"
  | "attendance_minutes"
  | "task_minutes"
  | "untracked_minutes"
  | "task_count"
  | "form_count"
  | "efficiency_percent";
type SortDirection = "asc" | "desc";

const numberFmt = new Intl.NumberFormat("fa-IR");

const number = (value: number) => numberFmt.format(value);
const dateTime = (value: string) => formatPersianDateTime(value);

function formatMonthlyTrendLabel(label: string): string {
  const gregorianMonth = label.match(/^(\d{4})[/-](\d{2})$/);
  if (!gregorianMonth || Number(gregorianMonth[1]) < 1700) return label;
  return formatPersianDate(`${gregorianMonth[1]}-${gregorianMonth[2]}-01`).slice(0, 7);
}

function jalaliToday(): DateObject {
  return new DateObject({
    date: getTodayPersian(),
    format: "YYYY/MM/DD",
    calendar: persian,
    locale: persian_fa,
  });
}

function asDate(value: DateObject): string {
  return value.format("YYYY/MM/DD");
}

function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (!hours) return `${number(remainder)} دقیقه`;
  if (!remainder) return `${number(hours)} ساعت`;
  return `${number(hours)} س ${number(remainder)} د`;
}

function SelectField({
  label,
  value,
  onChange,
  children,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-10 pl-9 text-sm font-medium text-slate-700 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  );
}

function HorizontalChart({
  items,
  color = "bg-red-500",
  valueFormatter = number,
}: {
  items: ChartItem[];
  color?: string;
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  if (!items.length) {
    return <p className="py-10 text-center text-sm text-slate-400">هنوز داده‌ای ثبت نشده است.</p>;
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-slate-600">{item.label}</span>
            <span className="shrink-0 font-bold text-slate-800">{valueFormatter(item.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${Math.max((item.value / max) * 100, item.value ? 5 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const pieColors = ["#dc2626", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2"];

function PieChart({ items }: { items: ChartItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total) {
    return <p className="py-16 text-center text-sm text-slate-400">هنوز داده‌ای ثبت نشده است.</p>;
  }
  let cursor = 0;
  const stops = items.map((item, index) => {
    const start = cursor;
    cursor += (item.value / total) * 100;
    return `${pieColors[index % pieColors.length]} ${start}% ${cursor}%`;
  });
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <div className="relative h-44 w-44 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops.join(",")})` }}>
        <div className="absolute inset-8 grid place-items-center rounded-full bg-white shadow-inner">
          <div className="text-center"><p className="text-2xl font-extrabold text-slate-900">{number(total)}</p><p className="text-xs text-slate-400">مجموع</p></div>
        </div>
      </div>
      <div className="w-full max-w-xs space-y-2.5">
        {items.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-slate-600"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} /><span className="truncate">{item.label}</span></span>
            <b className="text-slate-800">{number(item.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimesheetTrendChart({ data }: { data: DailyTimesheetPoint[] }) {
  const visible = data.slice(-14);
  const max = Math.max(...visible.flatMap((item) => [item.attendance_minutes, item.task_minutes]), 60);
  const width = 720;
  const height = 210;
  const padding = 22;
  const x = (index: number) =>
    visible.length <= 1 ? width / 2 : padding + index * ((width - padding * 2) / (visible.length - 1));
  const y = (value: number) => height - padding - (value / max) * (height - padding * 2);
  const taskPoints = visible.map((item, index) => `${x(index)},${y(item.task_minutes)}`).join(" ");
  const attendancePoints = visible
    .map((item, index) => `${x(index)},${y(item.attendance_minutes)}`)
    .join(" ");

  if (!visible.length) {
    return <div className="grid h-64 place-items-center text-sm text-slate-400">برای این بازه داده‌ای ثبت نشده است.</div>;
  }

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full overflow-visible" role="img" aria-label="روند حضور و کار">
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding}
            x2={width - padding}
            y1={y(max * ratio)}
            y2={y(max * ratio)}
            stroke="#e2e8f0"
            strokeDasharray="4 6"
          />
        ))}
        <polyline points={attendancePoints} fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={taskPoints} fill="none" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {visible.map((item, index) => (
          <g key={item.date}>
            <circle cx={x(index)} cy={y(item.task_minutes)} r="4" fill="#fff" stroke="#dc2626" strokeWidth="3">
              <title>{`${item.date}: ${formatMinutes(item.task_minutes)}`}</title>
            </circle>
            {(visible.length <= 8 || index % 2 === 0) && (
              <text x={x(index)} y={height + 2} textAnchor="middle" className="fill-slate-400 text-[10px]">
                {item.date.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-5 text-xs font-semibold text-slate-500">
        <span className="flex items-center gap-2">
          <i className="h-2.5 w-2.5 rounded-full bg-red-600" />
          زمان تسک‌ها
        </span>
        <span className="flex items-center gap-2">
          <i className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          زمان حضور
        </span>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${color}`}>
        <Icon size={21} />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{detail}</p>
    </section>
  );
}

function CompactKpiCard({
  label,
  value,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <section className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
          <p className="shrink-0 text-xl font-extrabold text-slate-900">{value}</p>
        </div>
        <p className="mt-1 truncate text-[11px] text-slate-400" title={detail}>{detail}</p>
      </div>
    </section>
  );
}

export default function AdminDashboardPage() {
  const [startDate, setStartDate] = useState(() => new DateObject(jalaliToday()).subtract(6, "days"));
  const [endDate, setEndDate] = useState(() => jalaliToday());
  const [preset, setPreset] = useState<PeriodPreset>("week");
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [hideInactiveEmployees, setHideInactiveEmployees] = useState(true);
  const [employeeSortKey, setEmployeeSortKey] = useState<EmployeeSortKey>("task_minutes");
  const [employeeSortDirection, setEmployeeSortDirection] = useState<SortDirection>("desc");
  const [employeePage, setEmployeePage] = useState(1);
  const [employeePageSize, setEmployeePageSize] = useState(10);
  const [departmentSortKey, setDepartmentSortKey] = useState<DepartmentSortKey>("task_minutes");
  const [departmentSortDirection, setDepartmentSortDirection] = useState<SortDirection>("desc");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedProjectStatus, setSelectedProjectStatus] = useState<ProjectStatusFilter>("all");
  const [selectedForm, setSelectedForm] = useState("all");

  const applyPreset = (next: PeriodPreset) => {
    setPreset(next);
    if (next === "custom") return;
    const nextEnd = jalaliToday();
    const days = next === "today" ? 0 : next === "week" ? 6 : 29;
    const nextStart = new DateObject(nextEnd).subtract(days, "days");
    setEndDate(nextEnd);
    setStartDate(nextStart);
    void loadAnalytics(nextStart, nextEnd);
  };

  const loadAnalytics = async (start = startDate, end = endDate) => {
    const startStr = asDate(start);
    const endStr = asDate(end);
    if (startStr > endStr) {
      setError("تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetchAdminAnalytics({
        startDate: startStr,
        endDate: endStr,
        department: selectedDepartment === "all" ? undefined : selectedDepartment,
        employeeId: selectedEmployee === "all" ? undefined : selectedEmployee,
        projectCode: selectedProject === "all" ? undefined : selectedProject,
        projectStatus: selectedProjectStatus === "all" ? undefined : selectedProjectStatus,
        formId: selectedForm === "all" ? undefined : selectedForm,
      });
      setData(response);
    } catch {
      setError("دریافت اطلاعات داشبورد تحلیلی با مشکل مواجه شد.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterOptions = data?.filter_options;
  const availableEmployees = useMemo(() => {
    const rows = filterOptions?.employees || [];
    return selectedDepartment === "all"
      ? rows
      : rows.filter((item) => item.department === selectedDepartment);
  }, [filterOptions, selectedDepartment]);

  const projectOptions = filterOptions?.projects || [];

  const filteredEmployees = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLocaleLowerCase("fa");
    return data.employees.filter((row) => {
      if (hideInactiveEmployees && !row.attendance_minutes && !row.task_minutes && !row.form_count) {
        return false;
      }
      if (!normalized) return true;
      return [row.full_name, row.username, row.department, row.job_title].some((value) =>
        value.toLocaleLowerCase("fa").includes(normalized),
      );
    });
  }, [data, query, hideInactiveEmployees]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((first, second) => {
      const firstValue = first[employeeSortKey];
      const secondValue = second[employeeSortKey];
      const comparison =
        typeof firstValue === "string" && typeof secondValue === "string"
          ? firstValue.localeCompare(secondValue, "fa", { sensitivity: "base" })
          : Number(firstValue) - Number(secondValue);
      if (comparison !== 0) return employeeSortDirection === "asc" ? comparison : -comparison;
      return first.full_name.localeCompare(second.full_name, "fa", { sensitivity: "base" });
    });
  }, [filteredEmployees, employeeSortKey, employeeSortDirection]);

  const employeePageCount = Math.max(1, Math.ceil(sortedEmployees.length / employeePageSize));
  const safeEmployeePage = Math.min(employeePage, employeePageCount);
  const paginatedEmployees = sortedEmployees.slice(
    (safeEmployeePage - 1) * employeePageSize,
    safeEmployeePage * employeePageSize,
  );
  const employeeRangeStart = sortedEmployees.length ? (safeEmployeePage - 1) * employeePageSize + 1 : 0;
  const employeeRangeEnd = Math.min(safeEmployeePage * employeePageSize, sortedEmployees.length);

  useEffect(() => {
    setEmployeePage(1);
  }, [query, hideInactiveEmployees, employeeSortKey, employeeSortDirection, employeePageSize, data]);

  const filteredProjects = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLocaleLowerCase("fa");
    if (!normalized) return data.projects;
    return data.projects.filter((row) =>
      [row.code, row.title, ...(row.subprojects || []).flatMap((sub) => [sub.code, sub.title])].some(
        (value) => value.toLocaleLowerCase("fa").includes(normalized),
      ),
    );
  }, [data, query]);

  const filteredDepartments = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLocaleLowerCase("fa");
    if (!normalized) return data.departments;
    return data.departments.filter((row) => row.name.toLocaleLowerCase("fa").includes(normalized));
  }, [data, query]);

  const sortedDepartments = useMemo(() => {
    return [...filteredDepartments].sort((first, second) => {
      const firstValue = first[departmentSortKey];
      const secondValue = second[departmentSortKey];
      const comparison =
        typeof firstValue === "string" && typeof secondValue === "string"
          ? firstValue.localeCompare(secondValue, "fa", { sensitivity: "base" })
          : Number(firstValue) - Number(secondValue);
      if (comparison !== 0) return departmentSortDirection === "asc" ? comparison : -comparison;
      return first.name.localeCompare(second.name, "fa", { sensitivity: "base" });
    });
  }, [filteredDepartments, departmentSortKey, departmentSortDirection]);

  const formPeak = Math.max(...(data?.forms.monthly_trend.map((item) => item.value) || [1]), 1);
  const topEmployeeChart: ChartItem[] = filteredEmployees.slice(0, 8).map((row) => ({
    label: row.full_name,
    value: row.task_minutes,
  }));
  const topProjectChart: ChartItem[] = (data?.projects || []).slice(0, 8).map((row) => ({
    label: row.title || row.code,
    value: row.minutes,
  }));

  if (loading && !data) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="animate-spin text-red-600" />
          در حال آماده‌سازی داشبورد تحلیلی...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <BarChart3 size={25} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900">داشبورد تحلیلی</h2>
            <p className="mt-1 text-sm text-slate-500">
              تحلیل عملکرد کارکنان، پروژه‌ها، واحدها و درخواست‌های فرم
            </p>
          </div>
        </div>
        {data && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500" dir="ltr">
            {data.start_date} → {data.end_date}
          </p>
        )}
      </div>

      <section className="mb-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-800">فیلتر تحلیل</p>
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(
              [
                ["today", "امروز"],
                ["week", "۷ روز"],
                ["month", "۳۰ روز"],
                ["custom", "دلخواه"],
              ] as Array<[PeriodPreset, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyPreset(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  preset === value ? "bg-white text-red-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-500">از تاریخ</span>
            <JalaliDateTimePicker
              value={startDate}
              onChange={(value: any) => {
                if (value && !Array.isArray(value)) {
                  setStartDate(value);
                  setPreset("custom");
                }
              }}
              format="YYYY/MM/DD"
              placeholder="تاریخ شروع"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-500">تا تاریخ</span>
            <JalaliDateTimePicker
              value={endDate}
              onChange={(value: any) => {
                if (value && !Array.isArray(value)) {
                  setEndDate(value);
                  setPreset("custom");
                }
              }}
              format="YYYY/MM/DD"
              placeholder="تاریخ پایان"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            disabled={loading}
            className="mt-auto flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            {loading ? "در حال دریافت" : "اعمال فیلتر"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <SelectField
            label="واحد"
            value={selectedDepartment}
            onChange={(value) => {
              setSelectedDepartment(value);
              setSelectedEmployee("all");
            }}
            icon={<Building2 className="h-4 w-4" />}
          >
            <option value="all">همه واحدها</option>
            {(filterOptions?.departments || []).map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="شخص"
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            icon={<Users className="h-4 w-4" />}
          >
            <option value="all">همه کارکنان</option>
            {availableEmployees.map((employee) => (
              <option key={employee.employee_id} value={employee.employee_id}>
                {employee.full_name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="پروژه"
            value={selectedProject}
            onChange={setSelectedProject}
            icon={<BriefcaseBusiness className="h-4 w-4" />}
          >
            <option value="all">همه پروژه‌ها</option>
            {projectOptions.map((project) => (
              <option key={project.code} value={project.code}>
                {project.title || project.code}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="کد پروژه"
            value={selectedProject}
            onChange={setSelectedProject}
            icon={<Hash className="h-4 w-4" />}
          >
            <option value="all">همه کدها</option>
            {projectOptions.map((project) => (
              <option key={`code-${project.code}`} value={project.code}>
                {project.code}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="وضعیت پروژه"
            value={selectedProjectStatus}
            onChange={(value) => setSelectedProjectStatus(value as ProjectStatusFilter)}
            icon={<Target className="h-4 w-4" />}
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </SelectField>
          <SelectField
            label="فرم‌ها"
            value={selectedForm}
            onChange={setSelectedForm}
            icon={<FileText className="h-4 w-4" />}
          >
            <option value="all">همه فرم‌ها</option>
            {(filterOptions?.forms || []).map((form) => (
              <option key={form.id} value={form.id}>
                {form.title}
              </option>
            ))}
          </SelectField>
        </div>
      </section>

      {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      {data && (
        <>
          <div className="mb-6 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5">
            {(
              [
                ["overview", "نمای کلی"],
                ["employees", "کارکنان"],
                ["projects", "پروژه‌ها"],
                ["departments", "واحدها"],
                ["forms", "فرم‌ها"],
                ["letters", "نامه‌ها"],
              ] as Array<[AnalyticsTab, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  tab === value ? "bg-white text-red-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div><h3 className="font-extrabold text-slate-800">شاخص‌های کلیدی</h3><p className="mt-1 text-xs text-slate-400">خلاصه وضعیت سامانه در بازه انتخابی</p></div>
                  <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm">{number(data.overview.requests_in_range)} درخواست در بازه</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <CompactKpiCard
                  label="کل کاربران"
                  value={number(data.overview.total_users)}
                  detail={`${number(data.overview.active_users)} کاربر فعال`}
                  icon={Users}
                  color="bg-blue-50 text-blue-600"
                />
                <CompactKpiCard
                  label="درخواست‌های بازه"
                  value={number(data.overview.requests_in_range)}
                  detail={`امروز: ${number(data.overview.requests_today)} | کل: ${number(data.overview.total_requests)}`}
                  icon={FileText}
                  color="bg-red-50 text-red-600"
                />
                <CompactKpiCard
                  label="زمان ثبت‌شده"
                  value={formatMinutes(data.overview.task_minutes)}
                  detail={`${number(data.overview.task_count)} تسک | حضور ${formatMinutes(data.overview.attendance_minutes)}`}
                  icon={Clock3}
                  color="bg-amber-50 text-amber-600"
                />
                <CompactKpiCard
                  label="نرخ ثبت زمان"
                  value={`${number(Math.round(data.overview.efficiency_percent))}٪`}
                  detail={`${number(data.overview.active_employees)} کارمند فعال در تایم‌شیت`}
                  icon={Activity}
                  color="bg-emerald-50 text-emerald-600"
                />
                <CompactKpiCard
                  label="پروژه‌های فعال"
                  value={number(data.overview.project_count)}
                  detail="با فعالیت ثبت‌شده در بازه"
                  icon={BriefcaseBusiness}
                  color="bg-violet-50 text-violet-600"
                />
                <CompactKpiCard
                  label="واحدهای سازمانی"
                  value={number(data.overview.department_count)}
                  detail="در گزارش ترکیبی"
                  icon={Building2}
                  color="bg-sky-50 text-sky-600"
                />
                <CompactKpiCard
                  label="حضور باز"
                  value={number(data.overview.open_check_ins)}
                  detail="بدون ثبت خروج"
                  icon={TimerReset}
                  color="bg-orange-50 text-orange-600"
                />
                <CompactKpiCard
                  label="دستگاه‌های مدیر"
                  value={number(data.overview.active_admin_devices)}
                  detail="نشست‌های فعال"
                  icon={MonitorSmartphone}
                  color="bg-slate-100 text-slate-600"
                />
                <CompactKpiCard
                  label="نامه‌های سازمانی"
                  value={number(data.letters.total_letters)}
                  detail="نامه یکتا در بازه انتخابی"
                  icon={Mail}
                  color="bg-rose-50 text-rose-600"
                />
                <CompactKpiCard
                  label="گیرندگان نامه‌ها"
                  value={number(data.letters.recipient_copies)}
                  detail={`${number(data.letters.open_copies)} مورد باز`}
                  icon={Send}
                  color="bg-cyan-50 text-cyan-600"
                />
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-3">
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
                  <h3 className="mb-2 font-bold text-slate-800">روند حضور و زمان ثبت‌شده</h3>
                  <p className="mb-2 text-xs text-slate-400">مقایسه روزانه زمان حضور و تسک‌ها</p>
                  <TimesheetTrendChart data={data.timesheet_daily_trend} />
                </section>
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-6 font-bold text-slate-800">درخواست‌ها بر اساس وضعیت</h3>
                  <HorizontalChart items={data.forms.by_status} color="bg-emerald-500" />
                </section>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-6 font-bold text-slate-800">سهم زمان پروژه‌ها</h3>
                  <HorizontalChart items={topProjectChart} color="bg-violet-500" valueFormatter={formatMinutes} />
                </section>
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-6 font-bold text-slate-800">بیشترین درخواست‌ها بر اساس واحد سازمانی</h3>
                  <HorizontalChart items={data.forms.by_org_department.slice(0, 8)} />
                </section>
              </div>

              <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="mb-6 font-bold text-slate-800">روند درخواست‌ها در ۶ ماه گذشته</h3>
                <div className="flex h-64 items-end gap-3 border-b border-slate-100 px-2 pt-6">
                  {data.forms.monthly_trend.map((item) => (
                    <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-xs font-bold text-slate-600">{number(item.value)}</span>
                      <div
                        className="w-full max-w-16 rounded-t-xl bg-gradient-to-t from-red-600 to-red-400 transition-all"
                        style={{ height: `${Math.max((item.value / formPeak) * 78, item.value ? 8 : 2)}%` }}
                        title={`${formatMonthlyTrendLabel(item.label)}: ${item.value}`}
                      />
                      <span className="whitespace-nowrap text-[11px] text-slate-400" dir="ltr">
                        {formatMonthlyTrendLabel(item.label)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "employees" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="relative block sm:w-80">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-50"
                    placeholder="جستجوی کارمند..."
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={hideInactiveEmployees}
                    onChange={(event) => setHideInactiveEmployees(event.target.checked)}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  فقط کارکنان دارای فعالیت در بازه
                </label>
              </div>

              <div className="grid gap-6 xl:grid-cols-5">
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
                  <h3 className="mb-6 font-bold text-slate-800">بیشترین زمان ثبت‌شده</h3>
                  <HorizontalChart items={topEmployeeChart} color="bg-red-500" valueFormatter={formatMinutes} />
                </section>
                <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm xl:col-span-3">
                  <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800">جدول عملکرد کارکنان</h3>
                      <p className="mt-1 text-xs text-slate-400">{number(filteredEmployees.length)} نفر</p>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-bold text-slate-500">مرتب‌سازی بر اساس</span>
                        <select
                          value={employeeSortKey}
                          onChange={(event) => setEmployeeSortKey(event.target.value as EmployeeSortKey)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-50"
                        >
                          <option value="full_name">نام کارمند</option>
                          <option value="department">واحد</option>
                          <option value="active_days">روزهای فعال</option>
                          <option value="attendance_minutes">زمان حضور</option>
                          <option value="task_minutes">زمان تسک</option>
                          <option value="task_count">تعداد تسک‌ها</option>
                          <option value="form_count">تعداد فرم‌ها</option>
                          <option value="efficiency_percent">نرخ ثبت</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setEmployeeSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))
                        }
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:text-red-700"
                        aria-label="تغییر جهت مرتب‌سازی"
                      >
                        {employeeSortDirection === "asc" ? "صعودی ↑" : "نزولی ↓"}
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-right">کارمند</th>
                          <th className="px-4 py-3 text-right">واحد</th>
                          <th className="px-4 py-3 text-right">روز فعال</th>
                          <th className="px-4 py-3 text-right">حضور</th>
                          <th className="px-4 py-3 text-right">زمان تسک</th>
                          <th className="px-4 py-3 text-right">تسک‌ها</th>
                          <th className="px-4 py-3 text-right">فرم‌ها</th>
                          <th className="px-4 py-3 text-right">نرخ ثبت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedEmployees.map((row) => (
                          <tr key={row.employee_id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-800">{row.full_name}</p>
                              <p className="text-[11px] text-slate-400">{row.job_title || row.username}</p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.department}</td>
                            <td className="px-4 py-3">{number(row.active_days)}</td>
                            <td className="px-4 py-3">{formatMinutes(row.attendance_minutes)}</td>
                            <td className="px-4 py-3 font-bold text-red-700">{formatMinutes(row.task_minutes)}</td>
                            <td className="px-4 py-3">{number(row.task_count)}</td>
                            <td className="px-4 py-3">{number(row.form_count)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-red-500"
                                    style={{ width: `${Math.min(100, row.efficiency_percent)}%` }}
                                  />
                                </div>
                                <span className="font-bold">{number(Math.round(row.efficiency_percent))}٪</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filteredEmployees.length && (
                      <p className="p-10 text-center text-sm text-slate-400">کارمندی مطابق فیلتر یافت نشد.</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span>
                        نمایش {number(employeeRangeStart)} تا {number(employeeRangeEnd)} از {number(sortedEmployees.length)}
                      </span>
                      <label className="flex items-center gap-1.5">
                        <span>تعداد در صفحه:</span>
                        <select
                          value={employeePageSize}
                          onChange={(event) => setEmployeePageSize(Number(event.target.value))}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 font-bold text-slate-700 outline-none focus:border-red-400"
                        >
                          {[10, 20, 50].map((size) => (
                            <option key={size} value={size}>
                              {number(size)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEmployeePage((page) => Math.max(1, page - 1))}
                        disabled={safeEmployeePage === 1}
                        className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 font-bold text-slate-600 transition hover:border-red-200 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                        قبلی
                      </button>
                      <span className="min-w-20 text-center font-bold text-slate-700">
                        صفحه {number(safeEmployeePage)} از {number(employeePageCount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEmployeePage((page) => Math.min(employeePageCount, page + 1))}
                        disabled={safeEmployeePage === employeePageCount}
                        className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 font-bold text-slate-600 transition hover:border-red-200 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        بعدی
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {tab === "projects" && (
            <div className="space-y-6">
              <label className="relative block sm:w-80">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-50"
                  placeholder="جستجوی پروژه..."
                />
              </label>
              <div className="grid gap-6 xl:grid-cols-5">
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
                  <div className="mb-2 flex items-center gap-2">
                    <Target className="h-5 w-5 text-violet-500" />
                    <h3 className="font-bold text-slate-800">توزیع زمان پروژه‌ها</h3>
                  </div>
                  <p className="mb-6 text-xs text-slate-400">بر اساس مجموع دقایق تسک‌های ثبت‌شده</p>
                  <HorizontalChart
                    items={filteredProjects.slice(0, 10).map((row) => ({
                      label: row.title || row.code,
                      value: row.minutes,
                    }))}
                    color="bg-violet-500"
                    valueFormatter={formatMinutes}
                  />
                </section>
                <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm xl:col-span-3">
                  <div className="border-b border-slate-100 p-5">
                    <h3 className="font-bold text-slate-800">جزئیات پروژه‌ها و زیرپروژه‌ها</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-5 py-3 text-right">پروژه / زیرپروژه</th>
                          <th className="px-5 py-3 text-right">کد</th>
                          <th className="px-5 py-3 text-right">وضعیت</th>
                          <th className="px-5 py-3 text-right">زمان صرف‌شده</th>
                          <th className="px-5 py-3 text-right">تعداد تسک</th>
                          <th className="px-5 py-3 text-right">کارکنان</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProjects.map((row) => (
                          <Fragment key={row.code}>
                            <tr className="hover:bg-slate-50">
                              <td className="px-5 py-4 font-semibold text-slate-800">{row.title}</td>
                              <td className="px-5 py-4 font-mono text-xs text-violet-700" dir="ltr">
                                {row.code}
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                                    row.is_active === false
                                      ? "bg-slate-100 text-slate-500"
                                      : "bg-emerald-50 text-emerald-700"
                                  }`}
                                >
                                  {row.is_active === false ? "غیرفعال" : "فعال"}
                                </span>
                              </td>
                              <td className="px-5 py-4 font-bold text-red-700">{formatMinutes(row.minutes)}</td>
                              <td className="px-5 py-4">{number(row.task_count)}</td>
                              <td className="px-5 py-4">{number(row.employee_count)}</td>
                            </tr>
                            {(row.subprojects || []).map((sub) => (
                              <tr key={`${row.code}-${sub.code}`} className="bg-slate-50/60 hover:bg-slate-50">
                                <td className="px-5 py-3 pr-10 text-slate-600">
                                  <span className="text-xs text-slate-400">↳ </span>
                                  {sub.title}
                                </td>
                                <td className="px-5 py-3 font-mono text-xs text-sky-700" dir="ltr">
                                  {sub.code}
                                </td>
                                <td className="px-5 py-3 text-slate-400">—</td>
                                <td className="px-5 py-3 font-semibold text-slate-700">{formatMinutes(sub.minutes)}</td>
                                <td className="px-5 py-3">{number(sub.task_count)}</td>
                                <td className="px-5 py-3">{number(sub.employee_count)}</td>
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                    {!filteredProjects.length && (
                      <p className="p-10 text-center text-sm text-slate-400">پروژه‌ای با فعالیت در این بازه نیست.</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {tab === "departments" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="relative block sm:w-80">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-50"
                    placeholder="جستجوی واحد..."
                  />
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-slate-500">مرتب‌سازی بر اساس</span>
                    <select
                      value={departmentSortKey}
                      onChange={(event) => setDepartmentSortKey(event.target.value as DepartmentSortKey)}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-50"
                    >
                      <option value="name">نام واحد</option>
                      <option value="employee_count">تعداد کارکنان</option>
                      <option value="active_employees">کارکنان فعال</option>
                      <option value="attendance_minutes">زمان حضور</option>
                      <option value="task_minutes">زمان تسک</option>
                      <option value="untracked_minutes">زمان ثبت‌نشده</option>
                      <option value="task_count">تعداد تسک‌ها</option>
                      <option value="form_count">تعداد فرم‌ها</option>
                      <option value="efficiency_percent">نرخ ثبت</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDepartmentSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))
                    }
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:text-red-700"
                    aria-label="تغییر جهت مرتب‌سازی واحدها"
                  >
                    {departmentSortDirection === "asc" ? "صعودی ↑" : "نزولی ↓"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sortedDepartments.map((row) => (
                  <article key={row.name} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-extrabold text-slate-900">{row.name}</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {number(row.active_employees)} فعال از {number(row.employee_count)} نفر
                        </p>
                      </div>
                      <span className="rounded-xl bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                        {number(Math.round(row.efficiency_percent))}٪
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] text-slate-400">حضور</p>
                        <p className="mt-1 font-bold text-slate-800">{formatMinutes(row.attendance_minutes)}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] text-slate-400">زمان تسک</p>
                        <p className="mt-1 font-bold text-red-700">{formatMinutes(row.task_minutes)}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] text-slate-400">تسک‌ها</p>
                        <p className="mt-1 font-bold text-slate-800">{number(row.task_count)}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] text-slate-400">فرم‌ها</p>
                        <p className="mt-1 font-bold text-slate-800">{number(row.form_count)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <h3 className="font-bold text-slate-800">جدول مقایسه‌ای واحدها</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-5 py-3 text-right">واحد</th>
                        <th className="px-5 py-3 text-right">کارکنان</th>
                        <th className="px-5 py-3 text-right">حضور</th>
                        <th className="px-5 py-3 text-right">زمان تسک</th>
                        <th className="px-5 py-3 text-right">ثبت‌نشده</th>
                        <th className="px-5 py-3 text-right">تسک‌ها</th>
                        <th className="px-5 py-3 text-right">فرم‌ها</th>
                        <th className="px-5 py-3 text-right">نرخ ثبت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedDepartments.map((row) => (
                        <tr key={row.name} className="hover:bg-slate-50">
                          <td className="px-5 py-4 font-semibold text-slate-800">{row.name}</td>
                          <td className="px-5 py-4">
                            {number(row.active_employees)}/{number(row.employee_count)}
                          </td>
                          <td className="px-5 py-4">{formatMinutes(row.attendance_minutes)}</td>
                          <td className="px-5 py-4 font-bold text-red-700">{formatMinutes(row.task_minutes)}</td>
                          <td className="px-5 py-4 text-slate-500">{formatMinutes(row.untracked_minutes)}</td>
                          <td className="px-5 py-4">{number(row.task_count)}</td>
                          <td className="px-5 py-4 font-bold">{number(row.form_count)}</td>
                          <td className="px-5 py-4">{number(Math.round(row.efficiency_percent))}٪</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredDepartments.length && (
                    <p className="p-10 text-center text-sm text-slate-400">واحدی برای نمایش نیست.</p>
                  )}
                </div>
              </section>
            </div>
          )}

          {tab === "letters" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <KpiCard
                  label="تعداد نامه‌های ارسال‌شده"
                  value={number(data.letters.total_letters)}
                  detail="مجموع نامه‌های درون‌سازمانی و برون‌سازمانی"
                  icon={Mail}
                  color="bg-rose-50 text-rose-600"
                />
                <KpiCard
                  label="تعداد نامه‌های دیده‌شده"
                  value={number(data.letters.seen_copies)}
                  detail="مشاهده‌شده توسط گیرندگان هر دو نوع نامه"
                  icon={Eye}
                  color="bg-blue-50 text-blue-600"
                />
                <KpiCard
                  label="تعداد نامه‌های دیده‌نشده"
                  value={number(data.letters.unseen_copies)}
                  detail="مشاهده‌نشده توسط گیرندگان هر دو نوع نامه"
                  icon={EyeOff}
                  color="bg-slate-100 text-slate-600"
                />
                <KpiCard
                  label="تعداد گیرندگان نامه"
                  value={number(data.letters.recipient_copies)}
                  detail="مجموع گیرندگان هر دو نوع نامه"
                  icon={Users}
                  color="bg-cyan-50 text-cyan-600"
                />
                <KpiCard
                  label="در انتظار اقدام"
                  value={number(data.letters.open_copies)}
                  detail="اقدام‌نشده یا در حال انجام"
                  icon={Clock3}
                  color="bg-amber-50 text-amber-600"
                />
                <KpiCard
                  label="انجام‌شده"
                  value={number(data.letters.completed_copies)}
                  detail="نسخه‌های تکمیل‌شده توسط گیرندگان"
                  icon={MailCheck}
                  color="bg-emerald-50 text-emerald-600"
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800">نوع نامه‌ها</h3>
                  <p className="mb-6 mt-1 text-xs text-slate-400">سهم نامه‌های درون‌سازمانی و برون‌سازمانی</p>
                  <PieChart items={data.letters.by_type} />
                </section>
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800">وضعیت گیرندگان نامه</h3>
                  <p className="mb-6 mt-1 text-xs text-slate-400">وضعیت هر نسخه ارسال‌شده به گیرندگان</p>
                  <PieChart items={data.letters.by_status} />
                </section>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-6 font-bold text-slate-800">بیشترین ارسال‌کنندگان نامه</h3>
                  <HorizontalChart items={data.letters.top_senders} color="bg-rose-500" />
                </section>
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-6 font-bold text-slate-800">بیشترین گیرندگان نامه</h3>
                  <HorizontalChart items={data.letters.top_recipients} color="bg-cyan-500" />
                </section>
              </div>
            </div>
          )}

          {tab === "forms" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="درخواست‌های بازه"
                  value={number(data.overview.requests_in_range)}
                  detail="ثبت‌شده در بازه انتخابی"
                  icon={FileText}
                  color="bg-red-50 text-red-600"
                />
                <KpiCard
                  label="کل درخواست‌ها"
                  value={number(data.overview.total_requests)}
                  detail="از ابتدای فعالیت سامانه"
                  icon={CalendarClock}
                  color="bg-amber-50 text-amber-600"
                />
                <KpiCard
                  label="امروز"
                  value={number(data.overview.requests_today)}
                  detail="ثبت‌شده امروز"
                  icon={Activity}
                  color="bg-emerald-50 text-emerald-600"
                />
                <KpiCard
                  label="ثبت‌کنندگان برتر"
                  value={number(data.forms.top_submitters.length)}
                  detail="در فهرست ۱۰ نفر اول"
                  icon={Users}
                  color="bg-blue-50 text-blue-600"
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-6 font-bold text-slate-800">بر اساس واحد سازمانی</h3>
                  <HorizontalChart items={data.forms.by_org_department} />
                </section>
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-6 font-bold text-slate-800">بر اساس معاونت پرتال</h3>
                  <HorizontalChart items={data.forms.by_portal_department} color="bg-violet-500" />
                </section>
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-6 font-bold text-slate-800">وضعیت درخواست‌ها</h3>
                  <HorizontalChart items={data.forms.by_status} color="bg-emerald-500" />
                </section>
              </div>

              <div className="grid gap-6 xl:grid-cols-5">
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
                  <h3 className="mb-6 font-bold text-slate-800">انواع فرم پرتکرار</h3>
                  <HorizontalChart items={data.forms.by_form} color="bg-amber-500" />
                </section>
                <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm xl:col-span-3">
                  <div className="border-b border-slate-100 p-6">
                    <h3 className="font-bold text-slate-800">آخرین درخواست‌ها</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-5 py-3 text-right">درخواست</th>
                          <th className="px-5 py-3 text-right">کاربر</th>
                          <th className="px-5 py-3 text-right">وضعیت</th>
                          <th className="px-5 py-3 text-right">زمان</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.forms.recent_requests.map((request) => (
                          <tr key={request.id} className="hover:bg-slate-50">
                            <td className="px-5 py-4">
                              <p className="max-w-xs truncate font-semibold text-slate-700">
                                {request.subject || request.form_id}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">شناسه #{number(request.id)}</p>
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-slate-600">{request.submitted_by}</td>
                            <td className="whitespace-nowrap px-5 py-4 text-slate-500">{request.status}</td>
                            <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                              {dateTime(request.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!data.forms.recent_requests.length && (
                      <p className="p-10 text-center text-sm text-slate-400">درخواستی وجود ندارد.</p>
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="mb-6 font-bold text-slate-800">ثبت‌کنندگان پرتکرار</h3>
                <HorizontalChart items={data.forms.top_submitters} color="bg-sky-500" />
              </section>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
