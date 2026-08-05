import { useEffect, useMemo, useState } from 'react';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Pencil,
  Plus,
  Printer,
  Search,
  Sparkles,
  Target,
  TimerReset,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { formatUserDisplayName } from '@/lib/userDisplay';
import {
  adminCreateAttendance,
  adminCreateProject,
  adminCreateSubproject,
  adminCreateTask,
  adminDeleteAttendance,
  adminDeleteProject,
  adminDeleteSubproject,
  adminDeleteTask,
  adminUpdateAttendance,
  adminUpdateProject,
  adminUpdateSubproject,
  adminUpdateTask,
  fetchAdminProjects,
  fetchAdminRangeRecords,
  type AdminAttendanceRecord,
  type AdminRangeRecords,
  type AdminTaskRecord,
  type ProjectItem,
  type SubprojectItem,
  type TimesheetEmployee,
} from '@/features/timesheet/api';
import { Button } from '@/features/timesheet/components/ui/button';
import { Input } from '@/features/timesheet/components/ui/input';
import { JalaliDateTimePicker } from '@/features/timesheet/components/jalali-date-time-picker';
import { Logo } from '@/features/timesheet/components/logo';

type ReportTab = 'employees' | 'tasks' | 'attendance';
type PeriodPreset = 'today' | 'week' | 'month' | 'custom';
type EditorMode = 'attendance' | 'task' | null;

const numberFormatter = new Intl.NumberFormat('fa-IR');

function jalaliToday(): DateObject {
  return new DateObject({ calendar: persian, locale: persian_fa });
}

function asDate(value: DateObject): string {
  return value.format('YYYY/MM/DD');
}

function parseJalali(value?: string | null): DateObject | null {
  if (!value) return null;
  return new DateObject({
    date: value,
    format: 'YYYY/MM/DD',
    calendar: persian,
    locale: persian_fa,
  });
}

function parseTime(value?: string | null): DateObject | null {
  if (!value) return null;
  return new DateObject({
    date: value,
    format: 'HH:mm',
    calendar: persian,
    locale: persian_fa,
  });
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  if (!hours) return `${numberFormatter.format(remainder)} دقیقه`;
  if (!remainder) return `${numberFormatter.format(hours)} ساعت`;
  return `${numberFormatter.format(hours)} س ${numberFormatter.format(remainder)} د`;
}

function durationMinutes(start: string | null, end: string | null, workDate?: string): number {
  if (!start) return 0;
  if (!end && workDate && workDate !== asDate(jalaliToday())) return 0;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = (end || new Date().toTimeString().slice(0, 5)).split(':').map(Number);
  return Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute);
}

function escapeCsv(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function SelectField({
  label,
  value,
  onChange,
  children,
  icon,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  icon: React.ReactNode;
  disabled?: boolean;
}): JSX.Element {
  return (
    <label className='block min-w-0'>
      <span className='mb-1.5 block text-xs font-bold text-slate-500'>{label}</span>
      <span className='relative block'>
        <span className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400'>{icon}</span>
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className='h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-10 pl-9 text-sm font-medium text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/20 dark:disabled:bg-slate-800 dark:disabled:text-slate-500'
        >
          {children}
        </select>
        <ChevronDown className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
      </span>
    </label>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: 'cyan' | 'violet' | 'amber' | 'emerald';
}): JSX.Element {
  const tones = {
    cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-400/30',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/30',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30',
  };
  return (
    <article className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-800/90 dark:shadow-black/20'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='text-xs font-semibold text-slate-500 dark:text-slate-400'>{label}</p>
          <p className='mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50'>{value}</p>
          <p className='mt-1 text-[11px] text-slate-400 dark:text-slate-500'>{hint}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${tones[tone]}`}>{icon}</span>
      </div>
    </article>
  );
}

function TrendChart({
  data,
}: {
  data: Array<{ date: string; attendance: number; tasks: number }>;
}): JSX.Element {
  const visible = data.slice(-14);
  const max = Math.max(...visible.flatMap((item) => [item.attendance, item.tasks]), 60);
  const width = 720;
  const height = 210;
  const padding = 22;
  const x = (index: number) => visible.length <= 1 ? width / 2 : padding + index * ((width - padding * 2) / (visible.length - 1));
  const y = (value: number) => height - padding - (value / max) * (height - padding * 2);
  const taskPoints = visible.map((item, index) => `${x(index)},${y(item.tasks)}`).join(' ');
  const attendancePoints = visible.map((item, index) => `${x(index)},${y(item.attendance)}`).join(' ');

  if (!visible.length) {
    return <div className='grid h-64 place-items-center text-sm text-slate-400'>برای این بازه داده‌ای ثبت نشده است.</div>;
  }

  return (
    <div className='mt-4'>
      <svg viewBox={`0 0 ${width} ${height}`} className='h-56 w-full overflow-visible' role='img' aria-label='روند حضور و کار ثبت‌شده'>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line key={ratio} x1={padding} x2={width - padding} y1={y(max * ratio)} y2={y(max * ratio)} className='stroke-slate-200 dark:stroke-slate-700' strokeDasharray='4 6' />
        ))}
        <polyline points={attendancePoints} fill='none' className='stroke-slate-300 dark:stroke-slate-500' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' />
        <polyline points={taskPoints} fill='none' className='stroke-cyan-600 dark:stroke-cyan-400' strokeWidth='4' strokeLinecap='round' strokeLinejoin='round' />
        {visible.map((item, index) => (
          <g key={item.date}>
            <circle cx={x(index)} cy={y(item.tasks)} r='4' className='fill-white stroke-cyan-600 dark:fill-slate-900 dark:stroke-cyan-400' strokeWidth='3'>
              <title>{`${item.date}: ${formatMinutes(item.tasks)}`}</title>
            </circle>
            {(visible.length <= 8 || index % 2 === 0) && (
              <text x={x(index)} y={height + 2} textAnchor='middle' className='fill-slate-400 text-[10px] dark:fill-slate-500'>
                {item.date.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className='flex flex-wrap items-center gap-5 text-xs font-semibold text-slate-500 dark:text-slate-400'>
        <span className='flex items-center gap-2'><i className='h-2.5 w-2.5 rounded-full bg-cyan-600 dark:bg-cyan-400' />زمان تسک‌ها</span>
        <span className='flex items-center gap-2'><i className='h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-500' />زمان حضور</span>
      </div>
    </div>
  );
}

export function AdminPanel(): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = useMemo(() => jalaliToday(), []);
  const [startDate, setStartDate] = useState<DateObject>(new DateObject(today).subtract(6, 'days'));
  const [endDate, setEndDate] = useState<DateObject>(new DateObject(today));
  const [preset, setPreset] = useState<PeriodPreset>('week');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [records, setRecords] = useState<AdminRangeRecords | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [reportTab, setReportTab] = useState<ReportTab>('employees');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showProjects, setShowProjects] = useState(false);
  const [projectCode, setProjectCode] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectListSearch, setProjectListSearch] = useState('');
  const [selectedManageProject, setSelectedManageProject] = useState('');
  const [editingProjectCode, setEditingProjectCode] = useState<string | null>(null);
  const [subprojectCode, setSubprojectCode] = useState('');
  const [subprojectTitle, setSubprojectTitle] = useState('');
  const [editingSubprojectCode, setEditingSubprojectCode] = useState<string | null>(null);
  const [projectStartDate, setProjectStartDate] = useState<DateObject | null>(null);
  const [projectEndDate, setProjectEndDate] = useState<DateObject | null>(null);
  const [subprojectStartDate, setSubprojectStartDate] = useState<DateObject | null>(null);
  const [subprojectEndDate, setSubprojectEndDate] = useState<DateObject | null>(null);
  const [projectUserIds, setProjectUserIds] = useState<number[]>([]);
  const [subprojectUserIds, setSubprojectUserIds] = useState<number[]>([]);
  const [projectUserSearch, setProjectUserSearch] = useState('');
  const [subprojectUserSearch, setSubprojectUserSearch] = useState('');
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editingAttendanceId, setEditingAttendanceId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editorEmployeeId, setEditorEmployeeId] = useState('');
  const [editorWorkDate, setEditorWorkDate] = useState<DateObject | null>(today);
  const [editorCheckIn, setEditorCheckIn] = useState<DateObject | null>(null);
  const [editorCheckOut, setEditorCheckOut] = useState<DateObject | null>(null);
  const [editorProjectCode, setEditorProjectCode] = useState('');
  const [editorSubprojectCode, setEditorSubprojectCode] = useState('');
  const [editorTaskName, setEditorTaskName] = useState('');
  const [editorTaskStart, setEditorTaskStart] = useState<DateObject | null>(null);
  const [editorTaskEnd, setEditorTaskEnd] = useState<DateObject | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [status, setStatus] = useState('');
  const fullName = formatUserDisplayName(user, 'مدیر سیستم');

  const applyPreset = (nextPreset: PeriodPreset) => {
    setPreset(nextPreset);
    if (nextPreset === 'custom') return;
    const nextEnd = jalaliToday();
    const days = nextPreset === 'today' ? 0 : nextPreset === 'week' ? 6 : 29;
    setEndDate(nextEnd);
    setStartDate(new DateObject(nextEnd).subtract(days, 'days'));
  };

  const loadRecords = async () => {
    const start = asDate(startDate);
    const end = asDate(endDate);
    if (start > end) {
      setError('تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await fetchAdminRangeRecords({
        startDate: start,
        endDate: end,
        employeeId: selectedEmployee === 'all' ? undefined : selectedEmployee,
        department: selectedDepartment === 'all' ? undefined : selectedDepartment,
      });
      setRecords(next);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'دریافت گزارش با خطا روبه‌رو شد.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
    void fetchAdminProjects()
      .then((next) => {
        setProjects(next);
        if (next.length) setSelectedManageProject(next[0].code);
      })
      .catch(() => undefined);
  }, []);

  const availableEmployees = useMemo(() => {
    const rows = records?.employees || [];
    return selectedDepartment === 'all' ? rows : rows.filter((item) => item.department === selectedDepartment);
  }, [records, selectedDepartment]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fa');
    return (records?.tasks || []).filter((row) => {
      if (selectedProject !== 'all' && row.project_code !== selectedProject) return false;
      if (!normalizedQuery) return true;
      return [row.full_name, row.username, row.department, row.project_code, row.subproject_code || '', row.task_name, row.work_date]
        .some((value) => value.toLocaleLowerCase('fa').includes(normalizedQuery));
    });
  }, [records, selectedProject, query]);

  const filteredAttendance = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fa');
    return (records?.attendance || []).filter((row) => {
      if (!normalizedQuery) return true;
      return [row.full_name, row.username, row.department, row.work_date]
        .some((value) => value.toLocaleLowerCase('fa').includes(normalizedQuery));
    });
  }, [records, query]);

  const employeeRows = useMemo(() => {
    const attendance = new Map<string, number>();
    const taskMinutes = new Map<string, number>();
    const taskCounts = new Map<string, number>();
    const activeDays = new Map<string, Set<string>>();
    filteredAttendance.forEach((row) => {
      attendance.set(row.employee_id, (attendance.get(row.employee_id) || 0) + durationMinutes(row.check_in_time, row.check_out_time, row.work_date));
      const days = activeDays.get(row.employee_id) || new Set<string>();
      days.add(row.work_date);
      activeDays.set(row.employee_id, days);
    });
    filteredTasks.forEach((row) => {
      taskMinutes.set(row.employee_id, (taskMinutes.get(row.employee_id) || 0) + row.minutes_spent);
      taskCounts.set(row.employee_id, (taskCounts.get(row.employee_id) || 0) + 1);
    });
    let directory = availableEmployees;
    if (selectedEmployee !== 'all') directory = directory.filter((item) => item.employee_id === selectedEmployee);
    return directory.map((employee) => {
      const presence = attendance.get(employee.employee_id) || 0;
      const tracked = taskMinutes.get(employee.employee_id) || 0;
      return {
        ...employee,
        attendance: presence,
        tracked,
        untracked: Math.max(0, presence - tracked),
        tasks: taskCounts.get(employee.employee_id) || 0,
        activeDays: activeDays.get(employee.employee_id)?.size || 0,
        efficiency: presence ? Math.round((tracked / presence) * 100) : 0,
      };
    }).sort((a, b) => b.tracked - a.tracked);
  }, [availableEmployees, filteredAttendance, filteredTasks, selectedEmployee]);

  const visibleEmployeeRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fa');
    if (!normalizedQuery) return employeeRows;
    return employeeRows.filter((row) =>
      [row.full_name, row.username, row.department, row.job_title]
        .some((value) => value.toLocaleLowerCase('fa').includes(normalizedQuery)),
    );
  }, [employeeRows, query]);

  const dailyTrend = useMemo(() => {
    const dates = new Map<string, { date: string; attendance: number; tasks: number }>();
    filteredAttendance.forEach((row) => {
      const item = dates.get(row.work_date) || { date: row.work_date, attendance: 0, tasks: 0 };
      item.attendance += durationMinutes(row.check_in_time, row.check_out_time, row.work_date);
      dates.set(row.work_date, item);
    });
    filteredTasks.forEach((row) => {
      const item = dates.get(row.work_date) || { date: row.work_date, attendance: 0, tasks: 0 };
      item.tasks += row.minutes_spent;
      dates.set(row.work_date, item);
    });
    return Array.from(dates.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredAttendance, filteredTasks]);

  const projectRows = useMemo(() => {
    const map = new Map<string, { code: string; minutes: number; tasks: number; employees: Set<string> }>();
    filteredTasks.forEach((row) => {
      const item = map.get(row.project_code) || { code: row.project_code, minutes: 0, tasks: 0, employees: new Set<string>() };
      item.minutes += row.minutes_spent;
      item.tasks += 1;
      item.employees.add(row.employee_id);
      map.set(row.project_code, item);
    });
    return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
  }, [filteredTasks]);

  const analytics = useMemo(() => {
    const attendance = filteredAttendance.reduce((sum, row) => sum + durationMinutes(row.check_in_time, row.check_out_time, row.work_date), 0);
    const tracked = filteredTasks.reduce((sum, row) => sum + row.minutes_spent, 0);
    return {
      attendance,
      tracked,
      efficiency: attendance ? Math.round((tracked / attendance) * 100) : 0,
      activeEmployees: new Set([...filteredAttendance.map((row) => row.employee_id), ...filteredTasks.map((row) => row.employee_id)]).size,
      openAttendance: filteredAttendance.filter((row) => !row.check_out_time).length,
    };
  }, [filteredAttendance, filteredTasks]);

  const maxProjectMinutes = Math.max(projectRows[0]?.minutes || 0, 1);
  const filteredProjectList = projects.filter((item) => {
    const haystack = [
      item.code,
      item.title,
      ...(item.subprojects || []).flatMap((sub) => [sub.code, sub.title]),
    ]
      .join(' ')
      .toLocaleLowerCase('fa');
    return haystack.includes(projectListSearch.trim().toLocaleLowerCase('fa'));
  });
  const manageProject =
    projects.find((item) => item.code === selectedManageProject) || null;
  const directoryEmployees: TimesheetEmployee[] = records?.employees || [];
  const projectAssigneeOptions = useMemo(() => {
    const normalized = projectUserSearch.trim().toLocaleLowerCase('fa');
    if (!normalized) return directoryEmployees;
    return directoryEmployees.filter((employee) =>
      [employee.full_name, employee.username, employee.department, employee.job_title]
        .some((value) => value.toLocaleLowerCase('fa').includes(normalized)),
    );
  }, [directoryEmployees, projectUserSearch]);
  const subprojectAssigneePool = useMemo(
    () =>
      manageProject?.user_ids?.length
        ? directoryEmployees.filter((employee) =>
            manageProject.user_ids?.includes(Number(employee.employee_id)),
          )
        : directoryEmployees,
    [directoryEmployees, manageProject],
  );
  const subprojectAssigneeOptions = useMemo(() => {
    const normalized = subprojectUserSearch.trim().toLocaleLowerCase('fa');
    if (!normalized) return subprojectAssigneePool;
    return subprojectAssigneePool.filter((employee) =>
      [employee.full_name, employee.username, employee.department, employee.job_title]
        .some((value) => value.toLocaleLowerCase('fa').includes(normalized)),
    );
  }, [subprojectAssigneePool, subprojectUserSearch]);

  const resetProjectForm = () => {
    setEditingProjectCode(null);
    setProjectCode('');
    setProjectTitle('');
    setProjectStartDate(null);
    setProjectEndDate(null);
    setProjectUserIds([]);
  };

  const resetSubprojectForm = () => {
    setEditingSubprojectCode(null);
    setSubprojectCode('');
    setSubprojectTitle('');
    setSubprojectStartDate(null);
    setSubprojectEndDate(null);
    setSubprojectUserIds([]);
  };

  const fillProjectForm = (project: ProjectItem) => {
    setEditingProjectCode(project.code);
    setSelectedManageProject(project.code);
    setProjectCode(project.code);
    setProjectTitle(project.title || '');
    setProjectStartDate(parseJalali(project.start_date));
    setProjectEndDate(parseJalali(project.end_date));
    setProjectUserIds(project.user_ids || []);
    resetSubprojectForm();
  };

  const fillSubprojectForm = (subproject: SubprojectItem, parentCode: string) => {
    setSelectedManageProject(parentCode);
    setEditingSubprojectCode(subproject.code);
    setSubprojectCode(subproject.code);
    setSubprojectTitle(subproject.title || '');
    setSubprojectStartDate(parseJalali(subproject.start_date));
    setSubprojectEndDate(parseJalali(subproject.end_date));
    setSubprojectUserIds(subproject.user_ids || []);
  };

  const toggleUserId = (
    current: number[],
    employeeId: string,
    setter: (value: number[]) => void,
  ) => {
    const id = Number(employeeId);
    setter(
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const activeRowCount = reportTab === 'employees'
    ? visibleEmployeeRows.length
    : reportTab === 'tasks'
      ? filteredTasks.length
      : filteredAttendance.length;
  const pageCount = Math.max(1, Math.ceil(activeRowCount / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, activeRowCount);
  const pagedEmployees = visibleEmployeeRows.slice(pageStart, pageEnd);
  const pagedTasks = filteredTasks.slice(pageStart, pageEnd);
  const pagedAttendance = filteredAttendance.slice(pageStart, pageEnd);

  useEffect(() => {
    setPage(1);
  }, [
    reportTab,
    query,
    selectedProject,
    selectedEmployee,
    selectedDepartment,
    records?.start_date,
    records?.end_date,
    pageSize,
  ]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const exportCsv = () => {
    const header = ['تاریخ', 'کارمند', 'واحد', 'پروژه', 'زیرپروژه', 'شرح فعالیت', 'شروع', 'پایان', 'مدت (دقیقه)'];
    const rows = filteredTasks.map((row) => [
      row.work_date, row.full_name, row.department, row.project_code, row.subproject_code || '', row.task_name, row.start_time, row.end_time, row.minutes_spent,
    ]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `timesheet-${asDate(startDate)}-${asDate(endDate)}.csv`.replaceAll('/', '-');
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const createProject = async () => {
    if (!projectCode.trim()) return;
    if (!projectStartDate || !projectEndDate) {
      setError('بازه زمانی پروژه (از تاریخ / تا تاریخ) را مشخص کنید.');
      return;
    }
    if (projectCode.trim().toUpperCase() !== 'GENERAL' && !projectUserIds.length) {
      setError('حداقل یک کاربر را برای پروژه انتخاب کنید.');
      return;
    }
    const start = asDate(projectStartDate);
    const end = asDate(projectEndDate);
    if (start > end) {
      setError('تاریخ پایان پروژه نمی‌تواند قبل از تاریخ شروع باشد.');
      return;
    }
    const payload = {
      code: projectCode.trim(),
      title: projectTitle.trim() || undefined,
      start_date: start,
      end_date: end,
      user_ids: projectUserIds,
    };
    try {
      if (editingProjectCode) {
        await adminUpdateProject(editingProjectCode, payload);
      } else {
        await adminCreateProject(payload);
      }
      resetProjectForm();
      const next = await fetchAdminProjects();
      setProjects(next);
      if (next.length) {
        setSelectedManageProject(
          next.find((item) => item.code === payload.code)?.code || next[0].code,
        );
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'ذخیره پروژه با خطا روبه‌رو شد.');
    }
  };

  const createSubproject = async () => {
    if (!selectedManageProject || !subprojectCode.trim()) return;
    if (!subprojectStartDate || !subprojectEndDate) {
      setError('بازه زمانی زیرپروژه (از تاریخ / تا تاریخ) را مشخص کنید.');
      return;
    }
    if (!subprojectUserIds.length) {
      setError('حداقل یک کاربر را برای زیرپروژه انتخاب کنید.');
      return;
    }
    const start = asDate(subprojectStartDate);
    const end = asDate(subprojectEndDate);
    if (start > end) {
      setError('تاریخ پایان زیرپروژه نمی‌تواند قبل از تاریخ شروع باشد.');
      return;
    }
    const payload = {
      code: subprojectCode.trim(),
      title: subprojectTitle.trim() || undefined,
      start_date: start,
      end_date: end,
      user_ids: subprojectUserIds,
    };
    try {
      if (editingSubprojectCode) {
        await adminUpdateSubproject(editingSubprojectCode, payload);
      } else {
        await adminCreateSubproject(selectedManageProject, payload);
      }
      resetSubprojectForm();
      setProjects(await fetchAdminProjects());
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'ذخیره زیرپروژه با خطا روبه‌رو شد.');
    }
  };

  const deleteProject = async (project: ProjectItem) => {
    if (!window.confirm(`پروژه ${project.code} و زیرپروژه‌های آن حذف شود؟`)) return;
    try {
      await adminDeleteProject(project.code);
      const next = await fetchAdminProjects();
      setProjects(next);
      if (selectedManageProject === project.code || editingProjectCode === project.code) {
        setSelectedManageProject(next[0]?.code || '');
        resetProjectForm();
        resetSubprojectForm();
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'حذف پروژه با خطا روبه‌رو شد.');
    }
  };

  const deleteSubproject = async (code: string) => {
    if (!window.confirm(`زیرپروژه ${code} حذف شود؟`)) return;
    try {
      await adminDeleteSubproject(code);
      setProjects(await fetchAdminProjects());
      if (editingSubprojectCode === code) resetSubprojectForm();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'حذف زیرپروژه با خطا روبه‌رو شد.');
    }
  };

  const editorProjects = projects.filter((item) => item.is_active !== false);
  const editorSubprojects =
    editorProjects.find((item) => item.code === editorProjectCode)?.subprojects || [];

  const closeEditor = () => {
    setEditorMode(null);
    setEditingAttendanceId(null);
    setEditingTaskId(null);
    setEditorEmployeeId(selectedEmployee !== 'all' ? selectedEmployee : '');
    setEditorWorkDate(new DateObject(today));
    setEditorCheckIn(null);
    setEditorCheckOut(null);
    setEditorProjectCode(editorProjects[0]?.code || '');
    setEditorSubprojectCode('');
    setEditorTaskName('');
    setEditorTaskStart(null);
    setEditorTaskEnd(null);
  };

  const openAttendanceEditor = (row?: AdminAttendanceRecord) => {
    setError('');
    setStatus('');
    setEditorMode('attendance');
    setEditingTaskId(null);
    if (row) {
      setEditingAttendanceId(row.id);
      setEditorEmployeeId(row.employee_id);
      setEditorWorkDate(parseJalali(row.work_date));
      setEditorCheckIn(parseTime(row.check_in_time));
      setEditorCheckOut(parseTime(row.check_out_time));
    } else {
      setEditingAttendanceId(null);
      setEditorEmployeeId(selectedEmployee !== 'all' ? selectedEmployee : '');
      setEditorWorkDate(new DateObject(today));
      setEditorCheckIn(null);
      setEditorCheckOut(null);
    }
    setReportTab('attendance');
  };

  const openTaskEditor = (row?: AdminTaskRecord) => {
    setError('');
    setStatus('');
    setEditorMode('task');
    setEditingAttendanceId(null);
    const defaultProject = editorProjects[0]?.code || '';
    if (row) {
      setEditingTaskId(row.id);
      setEditorEmployeeId(row.employee_id);
      setEditorWorkDate(parseJalali(row.work_date));
      setEditorProjectCode(row.project_code);
      setEditorSubprojectCode(row.subproject_code || '');
      setEditorTaskName(row.task_name);
      setEditorTaskStart(parseTime(row.start_time));
      setEditorTaskEnd(parseTime(row.end_time));
    } else {
      setEditingTaskId(null);
      setEditorEmployeeId(selectedEmployee !== 'all' ? selectedEmployee : '');
      setEditorWorkDate(new DateObject(today));
      setEditorProjectCode(defaultProject);
      setEditorSubprojectCode('');
      setEditorTaskName('');
      setEditorTaskStart(null);
      setEditorTaskEnd(null);
    }
    setReportTab('tasks');
  };

  const saveAttendanceEditor = async () => {
    if (!editorEmployeeId || !editorWorkDate || !editorCheckIn) {
      setError('کارمند، تاریخ و ساعت ورود را مشخص کنید.');
      return;
    }
    const checkIn = editorCheckIn.format('HH:mm');
    const checkOut = editorCheckOut ? editorCheckOut.format('HH:mm') : null;
    if (checkOut && checkOut <= checkIn) {
      setError('ساعت خروج باید بعد از ساعت ورود باشد.');
      return;
    }
    setEditorBusy(true);
    setError('');
    setStatus('');
    try {
      if (editingAttendanceId) {
        await adminUpdateAttendance(editingAttendanceId, {
          work_date: asDate(editorWorkDate),
          check_in_time: checkIn,
          check_out_time: checkOut,
        });
        setStatus('تردد با موفقیت ویرایش شد.');
      } else {
        await adminCreateAttendance({
          employee_id: Number(editorEmployeeId),
          work_date: asDate(editorWorkDate),
          check_in_time: checkIn,
          check_out_time: checkOut,
        });
        setStatus('تردد با موفقیت ثبت شد.');
      }
      closeEditor();
      await loadRecords();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'ذخیره تردد با خطا روبه‌رو شد.');
    } finally {
      setEditorBusy(false);
    }
  };

  const saveTaskEditor = async () => {
    if (
      !editorEmployeeId
      || !editorWorkDate
      || !editorProjectCode
      || !editorTaskName.trim()
      || !editorTaskStart
      || !editorTaskEnd
    ) {
      setError('کارمند، تاریخ، پروژه، شرح و بازه زمانی فعالیت را کامل کنید.');
      return;
    }
    const start = editorTaskStart.format('HH:mm');
    const end = editorTaskEnd.format('HH:mm');
    if (end <= start) {
      setError('ساعت پایان باید بعد از ساعت شروع باشد.');
      return;
    }
    setEditorBusy(true);
    setError('');
    setStatus('');
    const payload = {
      work_date: asDate(editorWorkDate),
      project_code: editorProjectCode,
      subproject_code: editorSubprojectCode || null,
      task_name: editorTaskName.trim(),
      start_time: start,
      end_time: end,
    };
    try {
      if (editingTaskId) {
        await adminUpdateTask(editingTaskId, payload);
        setStatus('فعالیت با موفقیت ویرایش شد.');
      } else {
        await adminCreateTask({
          employee_id: Number(editorEmployeeId),
          ...payload,
        });
        setStatus('فعالیت با موفقیت ثبت شد.');
      }
      closeEditor();
      await loadRecords();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'ذخیره فعالیت با خطا روبه‌رو شد.');
    } finally {
      setEditorBusy(false);
    }
  };

  const removeAttendance = async (row: AdminAttendanceRecord) => {
    if (!window.confirm(`تردد ${row.full_name} در تاریخ ${row.work_date} حذف شود؟`)) return;
    setError('');
    setStatus('');
    try {
      await adminDeleteAttendance(row.id);
      setStatus('تردد حذف شد.');
      if (editingAttendanceId === row.id) closeEditor();
      await loadRecords();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'حذف تردد با خطا روبه‌رو شد.');
    }
  };

  const removeTask = async (row: AdminTaskRecord) => {
    if (!window.confirm(`فعالیت «${row.task_name}» حذف شود؟`)) return;
    setError('');
    setStatus('');
    try {
      await adminDeleteTask(row.id);
      setStatus('فعالیت حذف شد.');
      if (editingTaskId === row.id) closeEditor();
      await loadRecords();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'حذف فعالیت با خطا روبه‌رو شد.');
    }
  };

  return (
    <div className='min-h-screen bg-[#f5f7fb] font-sans text-slate-900 dark:bg-transparent dark:text-slate-100' dir='rtl'>
      <header className='no-print border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90'>
        <div className='mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-7'>
          <div className='flex items-center gap-5'>
            <Logo />
            <span className='hidden h-8 w-px bg-slate-200 dark:bg-slate-700 sm:block' />
            <div className='hidden sm:block'>
              <p className='text-sm font-black text-slate-800 dark:text-slate-100'>مرکز کنترل تایم‌شیت</p>
              <p className='text-[11px] text-slate-400 dark:text-slate-500'>گزارش مدیریتی حضور و عملکرد</p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <div className='hidden rounded-xl bg-slate-50 px-3 py-2 text-left sm:block dark:bg-slate-800'>
              <p className='text-xs font-bold text-slate-700 dark:text-slate-200'>{fullName}</p>
              <p className='text-[10px] text-slate-400 dark:text-slate-500'>مدیر تایم‌شیت</p>
            </div>
            <Button variant='outline' size='sm' onClick={() => navigate('/')} className='gap-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'>
              <ArrowRight className='h-4 w-4' /> بازگشت
            </Button>
          </div>
        </div>
      </header>

      <main id='timesheet-report' className='mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-7'>
        <section className='flex flex-col justify-between gap-4 lg:flex-row lg:items-end'>
          <div>
            <div className='mb-2 flex items-center gap-2 text-xs font-bold text-cyan-700 dark:text-cyan-300'>
              <Sparkles className='h-4 w-4' /> نمای مدیریتی
            </div>
            <h1 className='text-2xl font-black tracking-tight text-slate-950 sm:text-3xl dark:text-white'>گزارش جامع زمان و عملکرد</h1>
            <p className='mt-2 text-sm text-slate-500 dark:text-slate-400'>وضعیت کارکنان را ببینید و در صورت نیاز ورود/خروج یا فعالیت‌ها را ثبت و ویرایش کنید.</p>
          </div>
          <div className='no-print flex flex-wrap gap-2'>
            <Button variant='outline' onClick={() => openAttendanceEditor()} className='gap-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'>
              <Clock3 className='h-4 w-4' /> ثبت تردد
            </Button>
            <Button variant='outline' onClick={() => openTaskEditor()} className='gap-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'>
              <Plus className='h-4 w-4' /> افزودن فعالیت
            </Button>
            <Button variant='outline' onClick={() => setShowProjects((value) => !value)} className='gap-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'>
              <BriefcaseBusiness className='h-4 w-4' /> مدیریت پروژه‌ها
            </Button>
            <Button variant='outline' onClick={() => window.print()} className='gap-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'>
              <Printer className='h-4 w-4' /> چاپ
            </Button>
            <Button variant='outline' onClick={exportCsv} className='gap-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'>
              <Download className='h-4 w-4' /> خروجی CSV
            </Button>
          </div>
        </section>

        {error && !editorMode && <div className='no-print rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700'>{error}</div>}
        {status && <div className='no-print rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700'>{status}</div>}

        {editorMode && (
          <div
            className='no-print fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6'
            onMouseDown={closeEditor}
          >
            <section
              role='dialog'
              aria-modal='true'
              aria-label={editorMode === 'attendance' ? 'ویرایش تردد' : 'ویرایش فعالیت'}
              className='max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-slate-900 dark:text-slate-100'
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className='sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95'>
                <div>
                  <h2 className='text-lg font-black text-slate-900 dark:text-white'>
                    {editorMode === 'attendance'
                      ? (editingAttendanceId ? 'ویرایش تردد' : 'ثبت ورود / خروج')
                      : (editingTaskId ? 'ویرایش فعالیت' : 'افزودن فعالیت')}
                  </h2>
                  <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>
                    {editorMode === 'attendance'
                      ? 'ورود و خروج کارمند را ثبت یا اصلاح کنید.'
                      : 'فعالیت باید داخل یکی از بازه‌های حضور همان روز باشد.'}
                  </p>
                </div>
                <Button variant='outline' size='sm' onClick={closeEditor} className='shrink-0 gap-1 rounded-xl dark:border-slate-600 dark:bg-slate-800'>
                  <X className='h-4 w-4' /> بستن
                </Button>
              </div>

              <div className='space-y-4 px-5 py-5'>
                {error && (
                  <div className='rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700'>
                    {error}
                  </div>
                )}

                {editorMode === 'attendance' ? (
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <SelectField
                      label='کارمند'
                      value={editorEmployeeId}
                      onChange={setEditorEmployeeId}
                      icon={<Users className='h-4 w-4' />}
                      disabled={Boolean(editingAttendanceId)}
                    >
                      <option value=''>انتخاب کارمند</option>
                      {(records?.employees || []).map((employee) => (
                        <option key={employee.employee_id} value={employee.employee_id}>
                          {employee.full_name}
                        </option>
                      ))}
                    </SelectField>
                    <label>
                      <span className='mb-1.5 block text-xs font-bold text-slate-500'>تاریخ</span>
                      <JalaliDateTimePicker
                        value={editorWorkDate}
                        onChange={(value: any) => setEditorWorkDate(Array.isArray(value) ? value[0] : value)}
                        format='YYYY/MM/DD'
                        placeholder='تاریخ تردد'
                      />
                    </label>
                    <label>
                      <span className='mb-1.5 block text-xs font-bold text-slate-500'>ساعت ورود</span>
                      <JalaliDateTimePicker
                        value={editorCheckIn}
                        onChange={(value: any) => setEditorCheckIn(Array.isArray(value) ? value[0] : value)}
                        disableDayPicker
                        format='HH:mm'
                        placeholder='--:--'
                      />
                    </label>
                    <label>
                      <span className='mb-1.5 block text-xs font-bold text-slate-500'>ساعت خروج (اختیاری)</span>
                      <JalaliDateTimePicker
                        value={editorCheckOut}
                        onChange={(value: any) => setEditorCheckOut(Array.isArray(value) ? value[0] : value)}
                        disableDayPicker
                        format='HH:mm'
                        placeholder='باز بماند'
                      />
                    </label>
                    {editingAttendanceId && (
                      <p className='sm:col-span-2 text-xs text-slate-400'>
                        هنگام ویرایش، کارمند قابل تغییر نیست؛ فقط تاریخ و ساعات به‌روز می‌شوند.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <SelectField
                      label='کارمند'
                      value={editorEmployeeId}
                      onChange={setEditorEmployeeId}
                      icon={<Users className='h-4 w-4' />}
                      disabled={Boolean(editingTaskId)}
                    >
                      <option value=''>انتخاب کارمند</option>
                      {(records?.employees || []).map((employee) => (
                        <option key={employee.employee_id} value={employee.employee_id}>
                          {employee.full_name}
                        </option>
                      ))}
                    </SelectField>
                    <label>
                      <span className='mb-1.5 block text-xs font-bold text-slate-500'>تاریخ</span>
                      <JalaliDateTimePicker
                        value={editorWorkDate}
                        onChange={(value: any) => setEditorWorkDate(Array.isArray(value) ? value[0] : value)}
                        format='YYYY/MM/DD'
                        placeholder='تاریخ فعالیت'
                      />
                    </label>
                    <SelectField
                      label='پروژه'
                      value={editorProjectCode}
                      onChange={(value) => {
                        setEditorProjectCode(value);
                        setEditorSubprojectCode('');
                      }}
                      icon={<BriefcaseBusiness className='h-4 w-4' />}
                    >
                      {!editorProjects.length && <option value=''>پروژه‌ای نیست</option>}
                      {editorProjects.map((project) => (
                        <option key={project.code} value={project.code}>
                          {project.title || project.code}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label='زیرپروژه'
                      value={editorSubprojectCode}
                      onChange={setEditorSubprojectCode}
                      icon={<Target className='h-4 w-4' />}
                    >
                      <option value=''>بدون زیرپروژه</option>
                      {editorSubprojects.map((subproject) => (
                        <option key={subproject.code} value={subproject.code}>
                          {subproject.title || subproject.code}
                        </option>
                      ))}
                    </SelectField>
                    <label className='sm:col-span-2'>
                      <span className='mb-1.5 block text-xs font-bold text-slate-500'>شرح فعالیت</span>
                      <Input
                        value={editorTaskName}
                        onChange={(event) => setEditorTaskName(event.target.value)}
                        placeholder='مثلاً بررسی درخواست‌ها'
                      />
                    </label>
                    <label>
                      <span className='mb-1.5 block text-xs font-bold text-slate-500'>از ساعت</span>
                      <JalaliDateTimePicker
                        value={editorTaskStart}
                        onChange={(value: any) => setEditorTaskStart(Array.isArray(value) ? value[0] : value)}
                        disableDayPicker
                        format='HH:mm'
                        placeholder='--:--'
                      />
                    </label>
                    <label>
                      <span className='mb-1.5 block text-xs font-bold text-slate-500'>تا ساعت</span>
                      <JalaliDateTimePicker
                        value={editorTaskEnd}
                        onChange={(value: any) => setEditorTaskEnd(Array.isArray(value) ? value[0] : value)}
                        disableDayPicker
                        format='HH:mm'
                        placeholder='--:--'
                      />
                    </label>
                    {editingTaskId && (
                      <p className='sm:col-span-2 text-xs text-slate-400'>
                        هنگام ویرایش، کارمند قابل تغییر نیست.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className='sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95'>
                {editorMode === 'attendance' && editorCheckOut && (
                  <Button variant='outline' onClick={() => setEditorCheckOut(null)} className='rounded-xl dark:border-slate-600 dark:bg-slate-800'>
                    پاک کردن خروج
                  </Button>
                )}
                <Button variant='outline' onClick={closeEditor} className='rounded-xl dark:border-slate-600 dark:bg-slate-800'>
                  انصراف
                </Button>
                {editorMode === 'attendance' ? (
                  <Button
                    onClick={() => void saveAttendanceEditor()}
                    disabled={editorBusy || !editorEmployeeId}
                    className='gap-2 rounded-xl bg-cyan-700 text-white hover:bg-cyan-800'
                  >
                    {editorBusy ? <Activity className='h-4 w-4 animate-spin' /> : <Clock3 className='h-4 w-4' />}
                    {editingAttendanceId ? 'ذخیره تردد' : 'ثبت تردد'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => void saveTaskEditor()}
                    disabled={editorBusy || !editorEmployeeId}
                    className='gap-2 rounded-xl bg-cyan-700 text-white hover:bg-cyan-800'
                  >
                    {editorBusy ? <Activity className='h-4 w-4 animate-spin' /> : <Plus className='h-4 w-4' />}
                    {editingTaskId ? 'ذخیره فعالیت' : 'ثبت فعالیت'}
                  </Button>
                )}
              </div>
            </section>
          </div>
        )}

        <section className='no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-800/90 dark:shadow-black/20'>
          <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
            <div className='flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100'><Filter className='h-4 w-4 text-cyan-600 dark:text-cyan-400' /> فیلتر گزارش</div>
            <div className='flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900/80'>
              {([
                ['today', 'امروز'],
                ['week', '۷ روز'],
                ['month', '۳۰ روز'],
                ['custom', 'دلخواه'],
              ] as Array<[PeriodPreset, string]>).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => applyPreset(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${preset === value ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-700 dark:text-cyan-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-6'>
            <label>
              <span className='mb-1.5 block text-xs font-bold text-slate-500'>از تاریخ</span>
              <JalaliDateTimePicker value={startDate} onChange={(value: any) => { setStartDate(value); setPreset('custom'); }} format='YYYY/MM/DD' placeholder='تاریخ شروع' />
            </label>
            <label>
              <span className='mb-1.5 block text-xs font-bold text-slate-500'>تا تاریخ</span>
              <JalaliDateTimePicker value={endDate} onChange={(value: any) => { setEndDate(value); setPreset('custom'); }} format='YYYY/MM/DD' placeholder='تاریخ پایان' />
            </label>
            <SelectField label='واحد سازمانی' value={selectedDepartment} onChange={(value) => { setSelectedDepartment(value); setSelectedEmployee('all'); }} icon={<Building2 className='h-4 w-4' />}>
              <option value='all'>همه واحدها</option>
              {(records?.departments || []).map((department) => <option key={department} value={department}>{department}</option>)}
            </SelectField>
            <SelectField label='کارمند' value={selectedEmployee} onChange={setSelectedEmployee} icon={<Users className='h-4 w-4' />}>
              <option value='all'>همه کارکنان</option>
              {availableEmployees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.full_name}</option>)}
            </SelectField>
            <SelectField label='پروژه' value={selectedProject} onChange={setSelectedProject} icon={<BriefcaseBusiness className='h-4 w-4' />}>
              <option value='all'>همه پروژه‌ها</option>
              {projects.map((project) => <option key={project.code} value={project.code}>{project.title || project.code}</option>)}
            </SelectField>
            <Button onClick={() => void loadRecords()} disabled={loading} className='mt-auto h-11 gap-2 bg-cyan-700 text-white hover:bg-cyan-800'>
              {loading ? <Activity className='h-4 w-4 animate-spin' /> : <BarChart3 className='h-4 w-4' />}
              {loading ? 'در حال دریافت' : 'نمایش گزارش'}
            </Button>
          </div>
        </section>

        {showProjects && (
          <section className='no-print rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/90'>
            <div className='grid gap-5 xl:grid-cols-[380px_1fr]'>
              <div className='space-y-5'>
                <div>
                  <div className='flex items-center justify-between gap-2'>
                    <h2 className='font-black'>{editingProjectCode ? 'ویرایش پروژه' : 'افزودن پروژه'}</h2>
                    {editingProjectCode && (
                      <Button size='sm' variant='outline' onClick={resetProjectForm}>جدید</Button>
                    )}
                  </div>
                  <div className='mt-3 space-y-2'>
                    <Input
                      value={projectCode}
                      onChange={(event) => setProjectCode(event.target.value.toUpperCase())}
                      placeholder='کد پروژه، مثال PRJ-001'
                      disabled={editingProjectCode === 'GENERAL'}
                    />
                    <Input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} placeholder='عنوان پروژه' />
                    <div className='grid grid-cols-2 gap-2'>
                      <label>
                        <span className='mb-1.5 block text-xs font-bold text-slate-500'>از تاریخ</span>
                        <JalaliDateTimePicker
                          value={projectStartDate}
                          onChange={(value: any) => setProjectStartDate(Array.isArray(value) ? value[0] : value)}
                          format='YYYY/MM/DD'
                          placeholder='شروع دوره'
                        />
                      </label>
                      <label>
                        <span className='mb-1.5 block text-xs font-bold text-slate-500'>تا تاریخ</span>
                        <JalaliDateTimePicker
                          value={projectEndDate}
                          onChange={(value: any) => setProjectEndDate(Array.isArray(value) ? value[0] : value)}
                          format='YYYY/MM/DD'
                          placeholder='پایان دوره'
                        />
                      </label>
                    </div>
                    <div>
                      <div className='mb-1.5 flex items-center justify-between'>
                        <span className='text-xs font-bold text-slate-500'>کاربران مجاز</span>
                        <span className='text-[10px] text-slate-400'>{numberFormatter.format(projectUserIds.length)} نفر</span>
                      </div>
                      <div className='relative mb-2'>
                        <Search className='pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400' />
                        <Input
                          value={projectUserSearch}
                          onChange={(event) => setProjectUserSearch(event.target.value)}
                          className='h-9 pr-8 text-xs'
                          placeholder='جستجوی کارمند...'
                        />
                      </div>
                      <div className='max-h-36 space-y-1 overflow-auto rounded-xl border border-slate-200 p-2'>
                        {!directoryEmployees.length && (
                          <p className='p-2 text-xs text-slate-400'>ابتدا گزارش را بارگذاری کنید تا فهرست کارکنان آماده شود.</p>
                        )}
                        {directoryEmployees.length > 0 && !projectAssigneeOptions.length && (
                          <p className='p-2 text-xs text-slate-400'>کارمندی با این جستجو پیدا نشد.</p>
                        )}
                        {projectAssigneeOptions.map((employee) => {
                          const checked = projectUserIds.includes(Number(employee.employee_id));
                          return (
                            <label key={employee.employee_id} className='flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50'>
                              <input
                                type='checkbox'
                                checked={checked}
                                onChange={() => toggleUserId(projectUserIds, employee.employee_id, setProjectUserIds)}
                              />
                              <span className='font-bold text-slate-700'>{employee.full_name}</span>
                              <span className='text-slate-400'>{employee.department}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <Button onClick={() => void createProject()} className='w-full'>
                      {editingProjectCode ? 'ذخیره تغییرات پروژه' : 'ایجاد پروژه'}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className='flex items-center justify-between gap-2'>
                    <h2 className='font-black'>{editingSubprojectCode ? 'ویرایش زیرپروژه' : 'افزودن زیرپروژه'}</h2>
                    {editingSubprojectCode && (
                      <Button size='sm' variant='outline' onClick={resetSubprojectForm}>جدید</Button>
                    )}
                  </div>
                  <p className='mt-1 text-xs text-slate-400'>زیرپروژه به پروژه انتخاب‌شده در لیست اضافه می‌شود.</p>
                  <div className='mt-3 space-y-2'>
                    <select
                      value={selectedManageProject}
                      onChange={(event) => setSelectedManageProject(event.target.value)}
                      className='h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500'
                      disabled={Boolean(editingSubprojectCode)}
                    >
                      {!projects.length && <option value=''>پروژه‌ای موجود نیست</option>}
                      {projects.map((project) => (
                        <option key={project.code} value={project.code}>
                          {project.title || project.code} — {project.code}
                        </option>
                      ))}
                    </select>
                    <Input value={subprojectCode} onChange={(event) => setSubprojectCode(event.target.value.toUpperCase())} placeholder='کد زیرپروژه، مثال SUB-001' />
                    <Input value={subprojectTitle} onChange={(event) => setSubprojectTitle(event.target.value)} placeholder='عنوان زیرپروژه' />
                    <div className='grid grid-cols-2 gap-2'>
                      <label>
                        <span className='mb-1.5 block text-xs font-bold text-slate-500'>از تاریخ</span>
                        <JalaliDateTimePicker
                          value={subprojectStartDate}
                          onChange={(value: any) => setSubprojectStartDate(Array.isArray(value) ? value[0] : value)}
                          format='YYYY/MM/DD'
                          placeholder='شروع دوره'
                        />
                      </label>
                      <label>
                        <span className='mb-1.5 block text-xs font-bold text-slate-500'>تا تاریخ</span>
                        <JalaliDateTimePicker
                          value={subprojectEndDate}
                          onChange={(value: any) => setSubprojectEndDate(Array.isArray(value) ? value[0] : value)}
                          format='YYYY/MM/DD'
                          placeholder='پایان دوره'
                        />
                      </label>
                    </div>
                    <div>
                      <div className='mb-1.5 flex items-center justify-between'>
                        <span className='text-xs font-bold text-slate-500'>کاربران مجاز زیرپروژه</span>
                        <span className='text-[10px] text-slate-400'>{numberFormatter.format(subprojectUserIds.length)} نفر</span>
                      </div>
                      <div className='relative mb-2'>
                        <Search className='pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400' />
                        <Input
                          value={subprojectUserSearch}
                          onChange={(event) => setSubprojectUserSearch(event.target.value)}
                          className='h-9 pr-8 text-xs'
                          placeholder='جستجوی کارمند...'
                        />
                      </div>
                      <div className='max-h-36 space-y-1 overflow-auto rounded-xl border border-slate-200 p-2'>
                        {!subprojectAssigneePool.length && (
                          <p className='p-2 text-xs text-slate-400'>کاربری برای انتخاب موجود نیست.</p>
                        )}
                        {subprojectAssigneePool.length > 0 && !subprojectAssigneeOptions.length && (
                          <p className='p-2 text-xs text-slate-400'>کارمندی با این جستجو پیدا نشد.</p>
                        )}
                        {subprojectAssigneeOptions.map((employee) => {
                          const checked = subprojectUserIds.includes(Number(employee.employee_id));
                          return (
                            <label key={employee.employee_id} className='flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50'>
                              <input
                                type='checkbox'
                                checked={checked}
                                onChange={() => toggleUserId(subprojectUserIds, employee.employee_id, setSubprojectUserIds)}
                              />
                              <span className='font-bold text-slate-700'>{employee.full_name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <Button onClick={() => void createSubproject()} disabled={!selectedManageProject} className='w-full'>
                      {editingSubprojectCode ? 'ذخیره تغییرات زیرپروژه' : 'ایجاد زیرپروژه'}
                    </Button>
                  </div>
                </div>
              </div>
              <div>
                <Input value={projectListSearch} onChange={(event) => setProjectListSearch(event.target.value)} placeholder='جستجو در پروژه‌ها و زیرپروژه‌ها' />
                <div className='mt-2 max-h-[34rem] overflow-auto rounded-xl border border-slate-200'>
                  {filteredProjectList.map((project) => (
                    <div
                      key={project.code}
                      className={`border-b border-slate-100 last:border-0 ${selectedManageProject === project.code ? 'bg-cyan-50/50' : ''}`}
                    >
                      <div className='flex items-center justify-between gap-3 px-3 py-2'>
                        <button
                          type='button'
                          onClick={() => fillProjectForm(project)}
                          className='min-w-0 flex-1 text-right'
                        >
                          <b className='text-sm'>{project.title}</b>
                          <span className='mr-2 font-mono text-xs text-slate-400'>{project.code}</span>
                          <span className='mr-2 text-[10px] font-bold text-slate-400'>
                            {numberFormatter.format(project.subprojects?.length || 0)} زیرپروژه
                          </span>
                          <span className='mr-2 text-[10px] font-bold text-violet-600'>
                            {numberFormatter.format(project.user_ids?.length || 0)} کاربر
                          </span>
                          {(project.start_date || project.end_date) && (
                            <div className='mt-1 text-[10px] font-semibold text-cyan-700' dir='ltr'>
                              {project.start_date || '—'} → {project.end_date || '—'}
                            </div>
                          )}
                        </button>
                        <div className='flex shrink-0 gap-1'>
                          <Button size='sm' variant='outline' onClick={() => fillProjectForm(project)}>ویرایش</Button>
                          <Button size='sm' variant='outline' disabled={project.code === 'GENERAL'} onClick={() => void deleteProject(project)} className='text-rose-600'>حذف</Button>
                        </div>
                      </div>
                      {(project.subprojects || []).length > 0 && (
                        <div className='space-y-1 border-t border-slate-50 bg-slate-50/70 px-3 py-2'>
                          {(project.subprojects || []).map((subproject) => (
                            <div key={subproject.code} className='flex items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-1.5'>
                              <button
                                type='button'
                                className='min-w-0 flex-1 text-right'
                                onClick={() => fillSubprojectForm(subproject, project.code)}
                              >
                                <span className='text-xs font-bold text-slate-700'>{subproject.title}</span>
                                <span className='mr-2 font-mono text-[10px] text-sky-700'>{subproject.code}</span>
                                <span className='mr-2 text-[10px] text-violet-600'>
                                  {numberFormatter.format(subproject.user_ids?.length || 0)} کاربر
                                </span>
                                {(subproject.start_date || subproject.end_date) && (
                                  <div className='mt-0.5 text-[10px] font-semibold text-sky-600' dir='ltr'>
                                    {subproject.start_date || '—'} → {subproject.end_date || '—'}
                                  </div>
                                )}
                              </button>
                              <div className='flex shrink-0 gap-1'>
                                <Button size='sm' variant='outline' onClick={() => fillSubprojectForm(subproject, project.code)} className='h-7 px-2 text-[11px]'>ویرایش</Button>
                                <Button size='sm' variant='outline' onClick={() => void deleteSubproject(subproject.code)} className='h-7 px-2 text-[11px] text-rose-600'>حذف</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {!filteredProjectList.length && (
                    <div className='p-6 text-center text-sm text-slate-400'>پروژه‌ای پیدا نشد.</div>
                  )}
                </div>
                {manageProject && (
                  <p className='mt-3 text-xs text-slate-500'>
                    پروژه انتخاب‌شده برای زیرپروژه: <b>{manageProject.title || manageProject.code}</b>
                    {manageProject.start_date && manageProject.end_date && (
                      <span className='mr-2 text-cyan-700' dir='ltr'>
                        ({manageProject.start_date} → {manageProject.end_date})
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
          <MetricCard label='کل حضور' value={formatMinutes(analytics.attendance)} hint='در بازه انتخاب‌شده' icon={<Clock3 className='h-5 w-5' />} tone='cyan' />
          <MetricCard label='زمان ثبت‌شده' value={formatMinutes(analytics.tracked)} hint={`${numberFormatter.format(filteredTasks.length)} فعالیت ثبت‌شده`} icon={<Target className='h-5 w-5' />} tone='violet' />
          <MetricCard label='نرخ ثبت زمان' value={`${numberFormatter.format(analytics.efficiency)}٪`} hint='تسک نسبت به حضور' icon={<Activity className='h-5 w-5' />} tone='emerald' />
          <MetricCard label='کارمند فعال' value={numberFormatter.format(analytics.activeEmployees)} hint={`از ${numberFormatter.format(employeeRows.length)} کارمند`} icon={<Users className='h-5 w-5' />} tone='amber' />
          <MetricCard label='حضور باز' value={numberFormatter.format(analytics.openAttendance)} hint='بدون ثبت خروج' icon={<TimerReset className='h-5 w-5' />} tone='cyan' />
        </section>

        <section className='grid gap-5 xl:grid-cols-[1.55fr_1fr]'>
          <article className='rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.035)] dark:border-slate-700 dark:bg-slate-800/90 dark:shadow-black/20'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <h2 className='text-base font-black dark:text-slate-50'>روند زمان ثبت‌شده</h2>
                <p className='mt-1 text-xs text-slate-400'>مقایسه زمان حضور و فعالیت روزانه</p>
              </div>
              <span className='rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400'>{asDate(startDate)} تا {asDate(endDate)}</span>
            </div>
            <TrendChart data={dailyTrend} />
          </article>

          <article className='rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.035)] dark:border-slate-700 dark:bg-slate-800/90 dark:shadow-black/20'>
            <div className='flex items-start justify-between'>
              <div>
                <h2 className='text-base font-black dark:text-slate-50'>سهم پروژه‌ها</h2>
                <p className='mt-1 text-xs text-slate-400'>بر اساس زمان فعالیت ثبت‌شده</p>
              </div>
              <BriefcaseBusiness className='h-5 w-5 text-violet-500' />
            </div>
            <div className='mt-5 space-y-4'>
              {projectRows.slice(0, 6).map((project, index) => (
                <div key={project.code}>
                  <div className='mb-1.5 flex items-center justify-between gap-3 text-xs'>
                    <span className='truncate font-bold text-slate-700'><i className={`ml-2 inline-block h-2 w-2 rounded-full ${['bg-cyan-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500'][index % 4]}`} />{project.code}</span>
                    <span className='shrink-0 font-bold text-slate-500'>{formatMinutes(project.minutes)}</span>
                  </div>
                  <div className='h-2 overflow-hidden rounded-full bg-slate-100'>
                    <div className='h-full rounded-full bg-gradient-to-l from-cyan-500 to-violet-500' style={{ width: `${Math.max(4, project.minutes / maxProjectMinutes * 100)}%` }} />
                  </div>
                </div>
              ))}
              {!projectRows.length && <div className='grid h-48 place-items-center text-sm text-slate-400'>فعالیتی برای نمایش نیست.</div>}
            </div>
          </article>
        </section>

        <section className='rounded-2xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.035)] dark:border-slate-700 dark:bg-slate-800/90 dark:shadow-black/20'>
          <div className='flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center dark:border-slate-700'>
            <div className='flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900/80'>
              {([
                ['employees', 'کارکنان', visibleEmployeeRows.length],
                ['tasks', 'فعالیت‌ها', filteredTasks.length],
                ['attendance', 'ترددها', filteredAttendance.length],
              ] as Array<[ReportTab, string, number]>).map(([value, label, count]) => (
                <button key={value} onClick={() => setReportTab(value)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${reportTab === value ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-700 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  {label} <span className='mr-1 text-[10px] text-slate-400'>{numberFormatter.format(count)}</span>
                </button>
              ))}
            </div>
            <label className='no-print relative block sm:w-72'>
              <Search className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} className='pr-9 dark:border-slate-600 dark:bg-slate-900' placeholder='جستجو در گزارش...' />
            </label>
          </div>
          <div className='overflow-x-auto'>
            {reportTab === 'employees' && (
              <table className='w-full min-w-[850px] text-sm'>
                <thead><tr className='bg-slate-50/70 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400'><th className='p-3 text-right'>کارمند</th><th className='p-3 text-right'>واحد</th><th className='p-3 text-right'>روز فعال</th><th className='p-3 text-right'>حضور</th><th className='p-3 text-right'>زمان ثبت‌شده</th><th className='p-3 text-right'>ثبت‌نشده</th><th className='p-3 text-right'>نرخ ثبت</th><th className='p-3 text-right'>وضعیت</th></tr></thead>
                <tbody>
                  {pagedEmployees.map((row) => (
                    <tr key={row.employee_id} className='border-t border-slate-100 hover:bg-slate-50/60 dark:border-slate-700 dark:hover:bg-slate-900/50'>
                      <td className='p-3'><div className='font-bold text-slate-800 dark:text-slate-100'>{row.full_name}</div><div className='text-[10px] text-slate-400'>{row.job_title || row.username}</div></td>
                      <td className='p-3 text-slate-600 dark:text-slate-300'>{row.department}</td>
                      <td className='p-3'>{numberFormatter.format(row.activeDays)}</td>
                      <td className='p-3'>{formatMinutes(row.attendance)}</td>
                      <td className='p-3 font-bold text-cyan-700 dark:text-cyan-300'>{formatMinutes(row.tracked)}</td>
                      <td className='p-3 text-slate-500'>{formatMinutes(row.untracked)}</td>
                      <td className='p-3'><div className='flex items-center gap-2'><div className='h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700'><div className='h-full rounded-full bg-cyan-500' style={{ width: `${Math.min(100, row.efficiency)}%` }} /></div><b>{numberFormatter.format(row.efficiency)}٪</b></div></td>
                      <td className='p-3'><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.attendance === 0 ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300' : row.efficiency >= 70 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>{row.attendance === 0 ? 'بدون رکورد' : row.efficiency >= 70 ? 'مطلوب' : 'نیازمند بررسی'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {reportTab === 'tasks' && (
              <table className='w-full min-w-[1080px] text-sm'>
                <thead>
                  <tr className='bg-slate-50/70 text-xs text-slate-500'>
                    <th className='p-3 text-right'>تاریخ</th>
                    <th className='p-3 text-right'>کارمند</th>
                    <th className='p-3 text-right'>واحد</th>
                    <th className='p-3 text-right'>پروژه</th>
                    <th className='p-3 text-right'>زیرپروژه</th>
                    <th className='p-3 text-right'>شرح فعالیت</th>
                    <th className='p-3 text-right'>بازه زمانی</th>
                    <th className='p-3 text-right'>مدت</th>
                    <th className='no-print p-3 text-right'>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTasks.map((row) => (
                    <tr key={row.id} className='border-t border-slate-100 hover:bg-slate-50/60'>
                      <td className='p-3 font-mono text-xs'>{row.work_date}</td>
                      <td className='p-3 font-bold'>{row.full_name}</td>
                      <td className='p-3 text-slate-500'>{row.department}</td>
                      <td className='p-3 font-mono text-xs text-violet-700'>{row.project_code}</td>
                      <td className='p-3 font-mono text-xs text-sky-700'>{row.subproject_code || '—'}</td>
                      <td className='max-w-sm truncate p-3'>{row.task_name}</td>
                      <td className='p-3 font-mono text-xs'>{row.start_time} – {row.end_time}</td>
                      <td className='p-3 font-bold text-cyan-700'>{formatMinutes(row.minutes_spent)}</td>
                      <td className='no-print p-3'>
                        <div className='flex gap-1'>
                          <Button size='sm' variant='outline' onClick={() => openTaskEditor(row)} className='h-8 gap-1 px-2'>
                            <Pencil className='h-3.5 w-3.5' /> ویرایش
                          </Button>
                          <Button size='sm' variant='outline' onClick={() => void removeTask(row)} className='h-8 px-2 text-rose-600'>
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {reportTab === 'attendance' && (
              <table className='w-full min-w-[900px] text-sm'>
                <thead>
                  <tr className='bg-slate-50/70 text-xs text-slate-500'>
                    <th className='p-3 text-right'>تاریخ</th>
                    <th className='p-3 text-right'>کارمند</th>
                    <th className='p-3 text-right'>واحد</th>
                    <th className='p-3 text-right'>ورود</th>
                    <th className='p-3 text-right'>خروج</th>
                    <th className='p-3 text-right'>مدت حضور</th>
                    <th className='p-3 text-right'>وضعیت</th>
                    <th className='no-print p-3 text-right'>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAttendance.map((row) => (
                    <tr key={row.id} className='border-t border-slate-100 hover:bg-slate-50/60'>
                      <td className='p-3 font-mono text-xs'>{row.work_date}</td>
                      <td className='p-3 font-bold'>{row.full_name}</td>
                      <td className='p-3 text-slate-500'>{row.department}</td>
                      <td className='p-3 font-mono'>{row.check_in_time}</td>
                      <td className='p-3 font-mono'>{row.check_out_time || '—'}</td>
                      <td className='p-3 font-bold'>{formatMinutes(durationMinutes(row.check_in_time, row.check_out_time, row.work_date))}</td>
                      <td className='p-3'>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.check_out_time ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          {row.check_out_time ? 'تکمیل‌شده' : 'در حال حضور'}
                        </span>
                      </td>
                      <td className='no-print p-3'>
                        <div className='flex gap-1'>
                          <Button size='sm' variant='outline' onClick={() => openAttendanceEditor(row)} className='h-8 gap-1 px-2'>
                            <Pencil className='h-3.5 w-3.5' /> ویرایش
                          </Button>
                          <Button size='sm' variant='outline' onClick={() => void removeAttendance(row)} className='h-8 px-2 text-rose-600'>
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {((reportTab === 'employees' && !visibleEmployeeRows.length) || (reportTab === 'tasks' && !filteredTasks.length) || (reportTab === 'attendance' && !filteredAttendance.length)) && (
            <div className='border-t border-slate-100 p-10 text-center text-sm text-slate-400'>نتیجه‌ای مطابق فیلترها پیدا نشد.</div>
          )}
          {activeRowCount > 0 && (
            <div className='no-print flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row'>
              <div className='flex items-center gap-2 text-xs text-slate-500'>
                <span>نمایش</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className='h-8 rounded-lg border border-slate-200 bg-white px-2 font-bold text-slate-700 outline-none focus:border-cyan-500'
                  aria-label='تعداد ردیف در هر صفحه'
                >
                  <option value={10}>۱۰</option>
                  <option value={20}>۲۰</option>
                  <option value={50}>۵۰</option>
                </select>
                <span>ردیف در هر صفحه</span>
              </div>
              <div className='flex items-center gap-3'>
                <span className='text-xs font-medium text-slate-500'>
                  {numberFormatter.format(pageStart + 1)} تا {numberFormatter.format(pageEnd)} از {numberFormatter.format(activeRowCount)}
                </span>
                <div className='flex items-center gap-1'>
                  <button
                    type='button'
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={safePage === 1}
                    className='grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-35'
                    aria-label='صفحه قبل'
                  >
                    <ChevronRight className='h-4 w-4' />
                  </button>
                  <span className='min-w-20 text-center text-xs font-bold text-slate-700'>
                    صفحه {numberFormatter.format(safePage)} از {numberFormatter.format(pageCount)}
                  </span>
                  <button
                    type='button'
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    disabled={safePage === pageCount}
                    className='grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-35'
                    aria-label='صفحه بعد'
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <footer className='flex flex-wrap items-center justify-between gap-2 py-2 text-[11px] text-slate-400'>
          <span>آخرین گزارش: {records ? `${records.start_date} تا ${records.end_date}` : '—'}</span>
          <span className='flex items-center gap-1'><CalendarDays className='h-3.5 w-3.5' /> اطلاعات بر اساس تقویم شمسی</span>
        </footer>
      </main>
    </div>
  );
}
