import { useEffect, useMemo, useState } from 'react';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persianFa from 'react-date-object/locales/persian_fa';
import Papa from 'papaparse';
import {
  ArrowLeft,
  ArrowUpLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  FolderTree,
  Gauge,
  Hourglass,
  ListChecks,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  Sparkles,
  TimerReset,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import UserDisplayName from '@/components/UserDisplayName';

import {
  fetchMyRangeRecords,
  fetchProjects,
  fetchSummary,
  saveCheckIn,
  saveCheckOut,
  saveTask,
  type AttendanceSegment,
  type DaySummary,
  type ProjectItem,
  type TaskItem,
} from '@/features/timesheet/api';
import { Button } from '@/features/timesheet/components/ui/button';
import { Label } from '@/features/timesheet/components/ui/label';
import { Textarea } from '@/features/timesheet/components/ui/textarea';
import { JalaliDateTimePicker } from '@/features/timesheet/components/jalali-date-time-picker';
import { TasksGanttChart } from '@/features/timesheet/components/tasks-gantt-chart';
import logo from '@/assets/logo.png';

type WeekTimelineDay = {
  work_date: string;
  attendance: AttendanceSegment[];
  tasks: TaskItem[];
};

type PeriodPreset = 'today' | 'week' | 'month' | 'custom';
const ACTIVITY_PAGE_SIZE = 6;

const today = () =>
  new DateObject({ calendar: persian, locale: persianFa });

function normalizeDigits(value: string): string {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)));
}

function formatDate(value: DateObject): string {
  return normalizeDigits(value.format('YYYY/MM/DD'));
}

function dateRange(days: number): { start: DateObject; end: DateObject } {
  const end = today();
  const start = new DateObject(end).add(-(days - 1), 'day');
  return { start, end };
}

function datesBetween(startDate: string, endDate: string): string[] {
  const cursor = new DateObject({
    date: startDate,
    format: 'YYYY/MM/DD',
    calendar: persian,
    locale: persianFa,
  });
  const dates: string[] = [];
  for (let index = 0; index < 370; index += 1) {
    const value = formatDate(cursor);
    dates.push(value);
    if (value === endDate) break;
    cursor.add(1, 'day');
  }
  return dates;
}

function segmentMinutes(start: string, end: string | null): number {
  const [startHour, startMinute] = start.split(':').map(Number);
  const fallback = new Date();
  const endValue =
    end ?? `${String(fallback.getHours()).padStart(2, '0')}:${String(fallback.getMinutes()).padStart(2, '0')}`;
  const [endHour, endMinute] = endValue.split(':').map(Number);
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
}

function formatMinutes(minutes = 0): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (!hours) return `${remainder} دقیقه`;
  if (!remainder) return `${hours} ساعت`;
  return `${hours} ساعت و ${remainder} دقیقه`;
}

function isWithinPeriod(
  workDate: string,
  startDate?: string | null,
  endDate?: string | null,
): boolean {
  if (startDate && workDate < startDate) return false;
  if (endDate && workDate > endDate) return false;
  return true;
}

function formatPeriodLabel(
  startDate?: string | null,
  endDate?: string | null,
): string {
  if (!startDate && !endDate) return '';
  return ` (${startDate || '—'} → ${endDate || '—'})`;
}

function mapErrorToPersian(errorText: string): string {
  const dictionary: Record<string, string> = {
    'Employee must submit check-in first': 'ابتدا باید ورود خود را ثبت کنید.',
    'Task time must be within an active check-in period.':
      'زمان فعالیت باید داخل بازه حضور ثبت‌شده باشد.',
    'End time cannot be earlier than start time':
      'ساعت پایان نمی‌تواند قبل از ساعت شروع باشد.',
    'Failed to check-out': 'ثبت خروج انجام نشد. لطفاً دوباره تلاش کنید.',
    'Failed to check-in': 'ثبت ورود انجام نشد. لطفاً دوباره تلاش کنید.',
    'Failed to save task': 'ثبت فعالیت انجام نشد. لطفاً دوباره تلاش کنید.',
  };
  return dictionary[errorText] ?? errorText;
}

function extractApiError(error: unknown, fallback: string): string {
  const candidate = error as {
    response?: { data?: { detail?: unknown } };
    message?: unknown;
  };
  const detail = candidate?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (typeof candidate?.message === 'string') return candidate.message;
  return fallback;
}

type SummaryCardProps = {
  label: string;
  value: string;
  icon: JSX.Element;
  color: 'sky' | 'violet' | 'amber' | 'emerald';
  hint: string;
};

const summaryColors = {
  sky: 'border-sky-100 bg-sky-50/80 text-sky-700',
  violet: 'border-violet-100 bg-violet-50/80 text-violet-700',
  amber: 'border-amber-100 bg-amber-50/80 text-amber-700',
  emerald: 'border-emerald-100 bg-emerald-50/80 text-emerald-700',
};

function SummaryCard({ label, value, icon, color, hint }: SummaryCardProps) {
  return (
    <div className={`rounded-2xl border p-4 ${summaryColors[color]}`}>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-sm font-semibold'>{label}</span>
        <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 shadow-sm'>
          {icon}
        </span>
      </div>
      <div className='mt-4 text-xl font-extrabold text-slate-900'>{value}</div>
      <div className='mt-1 text-xs text-slate-500'>{hint}</div>
    </div>
  );
}

export function EmployeePanel(): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initialDate = useMemo(() => today(), []);

  const [taskDate, setTaskDate] = useState<DateObject | null>(initialDate);
  const [taskStartTime, setTaskStartTime] = useState<DateObject | null>(null);
  const [taskEndTime, setTaskEndTime] = useState<DateObject | null>(null);
  const [projectCode, setProjectCode] = useState('');
  const [subprojectCode, setSubprojectCode] = useState('');
  const [taskName, setTaskName] = useState('');

  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [weekTimeline, setWeekTimeline] = useState<WeekTimelineDay[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const initialRange = useMemo(() => dateRange(7), []);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('week');
  const [rangeStart, setRangeStart] = useState<DateObject | null>(
    initialRange.start,
  );
  const [rangeEnd, setRangeEnd] = useState<DateObject | null>(initialRange.end);
  const [appliedStart, setAppliedStart] = useState(
    formatDate(initialRange.start),
  );
  const [appliedEnd, setAppliedEnd] = useState(
    formatDate(initialRange.end),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [activityPage, setActivityPage] = useState(1);

  const selectedTaskDate =
    taskDate ? formatDate(taskDate) : formatDate(initialDate);
  const attendanceIsActive = Boolean(summary?.is_currently_checked_in);
  const periodLabel =
    appliedStart === appliedEnd
      ? appliedStart
      : `از ${appliedStart} تا ${appliedEnd}`;
  const rangeStats = useMemo(() => {
    const attendanceMinutes = weekTimeline.reduce(
      (total, day) =>
        total +
        day.attendance.reduce(
          (dayTotal, item) =>
            dayTotal + segmentMinutes(item.check_in_time, item.check_out_time),
          0,
        ),
      0,
    );
    const taskMinutes = tasks.reduce(
      (total, task) => total + task.minutes_spent,
      0,
    );
    return {
      attendanceMinutes,
      taskMinutes,
      untrackedMinutes: Math.max(attendanceMinutes - taskMinutes, 0),
      coverage: attendanceMinutes
        ? Math.round((taskMinutes / attendanceMinutes) * 10000) / 100
        : 0,
    };
  }, [tasks, weekTimeline]);
  const orderedTasks = useMemo(
    () =>
      [...tasks].sort(
        (first, second) =>
          second.work_date.localeCompare(first.work_date) ||
          second.start_time.localeCompare(first.start_time),
      ),
    [tasks],
  );
  const activityPageCount = Math.max(
    1,
    Math.ceil(orderedTasks.length / ACTIVITY_PAGE_SIZE),
  );
  const paginatedTasks = orderedTasks.slice(
    (activityPage - 1) * ACTIVITY_PAGE_SIZE,
    activityPage * ACTIVITY_PAGE_SIZE,
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.code === projectCode) || null,
    [projects, projectCode],
  );
  const availableProjects = useMemo(
    () =>
      projects.filter((project) =>
        isWithinPeriod(selectedTaskDate, project.start_date, project.end_date),
      ),
    [projects, selectedTaskDate],
  );
  const availableSubprojects = useMemo(
    () =>
      (selectedProject?.subprojects || []).filter((subproject) =>
        isWithinPeriod(
          selectedTaskDate,
          subproject.start_date,
          subproject.end_date,
        ),
      ),
    [selectedProject, selectedTaskDate],
  );
  const coverage = Math.max(
    0,
    Math.min(100, rangeStats.coverage),
  );

  useEffect(() => {
    void loadRange(
      formatDate(initialRange.start),
      formatDate(initialRange.end),
    );
  }, [initialRange]);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await fetchProjects();
        setProjects(rows);
        if (rows.length > 0) {
          setProjectCode(rows[0].code);
          setSubprojectCode('');
        }
      } catch (fetchError) {
        console.error(fetchError);
      }
    })();
  }, []);

  useEffect(() => {
    if (!availableProjects.some((item) => item.code === projectCode)) {
      setProjectCode(availableProjects[0]?.code || '');
      setSubprojectCode('');
    }
  }, [availableProjects, projectCode]);

  useEffect(() => {
    if (!availableSubprojects.some((item) => item.code === subprojectCode)) {
      setSubprojectCode('');
    }
  }, [availableSubprojects, subprojectCode]);

  useEffect(() => {
    let cancelled = false;

    const refreshAttendance = async () => {
      try {
        const freshSummary = await fetchSummary(formatDate(today()));
        if (!cancelled) setSummary(freshSummary);
      } catch (refreshError) {
        // A background refresh must not replace the user's current form error.
        console.error(refreshError);
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshAttendance();
    };

    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('pageshow', refreshWhenVisible);
    window.addEventListener('online', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const refreshTimer = window.setInterval(refreshWhenVisible, 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('pageshow', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(refreshTimer);
    };
  }, []);

  async function loadRange(startDate: string, endDate: string): Promise<void> {
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      setError('تاریخ پایان باید بعد از تاریخ شروع باشد.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const [todaySummary, records] = await Promise.all([
        fetchSummary(formatDate(today())),
        fetchMyRangeRecords(startDate, endDate),
      ]);
      const dates = datesBetween(startDate, endDate);

      setSummary(todaySummary);
      setTasks(records.tasks || []);
      setActivityPage(1);
      setWeekTimeline(
        dates.map((workDate) => ({
          work_date: workDate,
          attendance: (records.attendance || []).filter(
            (item) => normalizeDigits(item.work_date) === workDate,
          ),
          tasks: (records.tasks || []).filter(
            (item) => normalizeDigits(item.work_date) === workDate,
          ),
        })),
      );
      setAppliedStart(startDate);
      setAppliedEnd(endDate);
    } catch (fetchError) {
      console.error(fetchError);
      setError('دریافت اطلاعات بازه با مشکل روبه‌رو شد. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsLoading(false);
    }
  }

  function applyPreset(preset: Exclude<PeriodPreset, 'custom'>) {
    const days = preset === 'today' ? 1 : preset === 'week' ? 7 : 30;
    const nextRange = dateRange(days);
    setPeriodPreset(preset);
    setRangeStart(nextRange.start);
    setRangeEnd(nextRange.end);
    void loadRange(
      formatDate(nextRange.start),
      formatDate(nextRange.end),
    );
  }

  function applyCustomRange() {
    const start = rangeStart ? formatDate(rangeStart) : '';
    const end = rangeEnd ? formatDate(rangeEnd) : '';
    if (!start || !end) {
      setError('لطفاً تاریخ شروع و پایان بازه را انتخاب کنید.');
      return;
    }
    setPeriodPreset('custom');
    void loadRange(start, end);
  }

  async function handleToggleAttendance(): Promise<void> {
    setError('');
    setStatus('');
    setAttendanceBusy(true);

    try {
      const now = today();
      const currentWorkDate = formatDate(now);
      const currentTime = now.format('HH:mm');
      // Revalidate immediately before mutating. This covers another tab having
      // changed attendance after this tab last rendered.
      const freshSummary = await fetchSummary(currentWorkDate);
      setSummary(freshSummary);
      const currentlyCheckedIn = freshSummary.is_currently_checked_in;

      if (currentlyCheckedIn) {
        await saveCheckOut({
          work_date: currentWorkDate,
          check_out_time: currentTime,
        });
        setStatus('خروج شما با موفقیت ثبت شد.');
      } else {
        await saveCheckIn({
          work_date: currentWorkDate,
          check_in_time: currentTime,
        });
        setStatus('ورود شما با موفقیت ثبت شد. روز خوبی داشته باشید!');
      }

      setTaskDate(now);
      await loadRange(appliedStart, appliedEnd);
    } catch (attendanceError) {
      const rawError = extractApiError(
        attendanceError,
        attendanceIsActive ? 'Failed to check-out' : 'Failed to check-in',
      );
      setError(mapErrorToPersian(rawError));
      // Recover the correct button state even when a concurrent tab won the
      // check-in/check-out race and the mutation itself was rejected.
      try {
        setSummary(await fetchSummary(formatDate(today())));
      } catch (refreshError) {
        console.error(refreshError);
      }
    } finally {
      setAttendanceBusy(false);
    }
  }

  async function handleAddTask(): Promise<void> {
    setError('');
    setStatus('');

    const workDate = taskDate ? formatDate(taskDate) : '';
    const startTime = taskStartTime?.format('HH:mm');
    const endTime = taskEndTime?.format('HH:mm');

    if (!workDate || !startTime || !endTime || !taskName.trim() || !projectCode) {
      setError('لطفاً تاریخ، ساعت، پروژه و شرح فعالیت را کامل کنید.');
      return;
    }

    setTaskBusy(true);
    try {
      await saveTask({
        work_date: workDate,
        project_code: projectCode,
        subproject_code: subprojectCode || null,
        task_name: taskName.trim(),
        start_time: startTime,
        end_time: endTime,
      });

      setStatus('فعالیت جدید با موفقیت ثبت شد.');
      setTaskName('');
      setTaskStartTime(null);
      setTaskEndTime(null);
      const selectedDate = new DateObject({
        date: workDate,
        format: 'YYYY/MM/DD',
        calendar: persian,
        locale: persianFa,
      });
      setPeriodPreset('custom');
      setRangeStart(selectedDate);
      setRangeEnd(new DateObject(selectedDate));
      await loadRange(workDate, workDate);
    } catch (taskError) {
      setError(
        mapErrorToPersian(extractApiError(taskError, 'Failed to save task')),
      );
    } finally {
      setTaskBusy(false);
    }
  }

  function exportCSV() {
    const csvContent = tasks.map((task) => ({
      تاریخ: task.work_date,
      پروژه: task.project_code,
      زیرپروژه: task.subproject_code || '',
      'ساعت شروع': task.start_time,
      'ساعت پایان': task.end_time,
      'مدت زمان (دقیقه)': task.minutes_spent,
      'شرح فعالیت': task.task_name,
    }));
    const csv = Papa.unparse(csvContent);
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = `timesheet_${appliedStart.replace(/\//g, '-')}_${appliedEnd.replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <div
      className='min-h-screen bg-[#f5f7fb] pb-12 text-slate-800 dark:bg-transparent dark:text-slate-100'
      dir='rtl'
    >
      <header className='border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90'>
        <div className='mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8'>
          <div className='flex min-w-0 items-center gap-3'>
            <img
              src={logo}
              alt='توسعه اعتماد گستر وثوق'
              className='h-11 w-auto object-contain sm:h-14'
            />
            <div className='hidden h-9 w-px bg-slate-200 dark:bg-slate-700 sm:block' />
            <div className='min-w-0'>
              <p className='truncate text-sm font-bold text-slate-900 sm:text-base dark:text-slate-50'>
                سامانه ثبت کارکرد
              </p>
              <p className='hidden text-xs text-slate-500 sm:block dark:text-slate-400'>
                مدیریت حضور و فعالیت‌های روزانه
              </p>
            </div>
          </div>

          <Button
            variant='outline'
            onClick={() => navigate('/')}
            className='h-10 shrink-0 gap-2 border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
            aria-label='بازگشت به صفحه اصلی'
          >
            <span>بازگشت</span>
            <ArrowLeft className='h-4 w-4' />
          </Button>
        </div>
      </header>

      <main className='mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6 lg:px-8'>
        <section className='overflow-hidden rounded-3xl bg-gradient-to-l from-slate-900 via-slate-800 to-sky-900 p-5 text-white shadow-xl shadow-slate-200 sm:p-7'>
          <div className='flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
            <div className='flex items-center gap-4'>
              <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20'>
                <UserRound className='h-7 w-7 text-sky-200' />
              </div>
              <div>
                <div className='mb-1 flex items-center gap-2 text-sm text-sky-200'>
                  <Sparkles className='h-4 w-4' />
                  خوش آمدید
                </div>
                <h1 className='text-2xl font-extrabold sm:text-3xl'>
                  <UserDisplayName
                    user={user}
                    fallback='کاربر'
                    badgeClassName='h-7 w-7 bg-amber-300/20 text-amber-200 ring-amber-200/30'
                  />
                </h1>
                <p className='mt-2 text-sm leading-6 text-slate-300'>
                  حضور امروز را ثبت کنید و فعالیت‌های روزانه‌تان را منظم پیش ببرید.
                </p>
              </div>
            </div>

            <div className='flex flex-col gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 sm:min-w-[360px] sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex items-center gap-3'>
                <span
                  className={`relative flex h-3 w-3 rounded-full ${
                    attendanceIsActive ? 'bg-emerald-400' : 'bg-slate-400'
                  }`}
                >
                  {attendanceIsActive && (
                    <span className='absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60' />
                  )}
                </span>
                <div>
                  <p className='text-xs text-slate-300'>وضعیت حضور امروز</p>
                  <p className='mt-1 font-bold'>
                    {attendanceIsActive ? 'در حال کار' : 'خارج از محل کار'}
                  </p>
                </div>
              </div>
              <Button
                size='lg'
                onClick={handleToggleAttendance}
                disabled={attendanceBusy}
                className={`gap-2 border-0 text-white shadow-lg ${
                  attendanceIsActive
                    ? 'bg-rose-500 hover:bg-rose-600'
                    : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {attendanceBusy ? (
                  <Loader2 className='h-5 w-5 animate-spin' />
                ) : attendanceIsActive ? (
                  <LogOut className='h-5 w-5' />
                ) : (
                  <LogIn className='h-5 w-5' />
                )}
                {attendanceIsActive ? 'ثبت خروج' : 'ثبت ورود'}
              </Button>
            </div>
          </div>
        </section>

        {(error || status) && (
          <div
            role='status'
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              error
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {error ? (
              <TimerReset className='mt-0.5 h-5 w-5 shrink-0' />
            ) : (
              <CheckCircle2 className='mt-0.5 h-5 w-5 shrink-0' />
            )}
            <span>{error || status}</span>
          </div>
        )}

        <section className='rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-800/90'>
          <div className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
            <div>
              <div className='flex items-center gap-2'>
                <Filter className='h-5 w-5 text-sky-600' />
                <h2 className='font-extrabold text-slate-900'>بازه گزارش</h2>
              </div>
              <p className='mt-1 text-xs leading-6 text-slate-500'>
                این بازه روی خلاصه، فهرست فعالیت‌ها، خروجی CSV و نمودار اعمال می‌شود.
              </p>
            </div>

            <div className='flex flex-col gap-3 lg:flex-row lg:items-end'>
              <div className='grid grid-cols-3 rounded-xl bg-slate-100 p-1'>
                {[
                  { value: 'today' as const, label: 'امروز' },
                  { value: 'week' as const, label: '۷ روز' },
                  { value: 'month' as const, label: '۳۰ روز' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type='button'
                    onClick={() => applyPreset(item.value)}
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                      periodPreset === item.value
                        ? 'bg-white text-sky-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className='grid grid-cols-2 gap-2'>
                <div className='space-y-1'>
                  <Label className='text-xs font-bold text-slate-500'>از تاریخ</Label>
                  <JalaliDateTimePicker
                    value={rangeStart}
                    onChange={(value) => {
                      const nextDate = Array.isArray(value) ? value[0] : value;
                      setRangeStart(nextDate || null);
                      setPeriodPreset('custom');
                    }}
                    format='YYYY/MM/DD'
                    placeholder='تاریخ شروع'
                  />
                </div>
                <div className='space-y-1'>
                  <Label className='text-xs font-bold text-slate-500'>تا تاریخ</Label>
                  <JalaliDateTimePicker
                    value={rangeEnd}
                    onChange={(value) => {
                      const nextDate = Array.isArray(value) ? value[0] : value;
                      setRangeEnd(nextDate || null);
                      setPeriodPreset('custom');
                    }}
                    format='YYYY/MM/DD'
                    placeholder='تاریخ پایان'
                  />
                </div>
              </div>

              <Button
                onClick={applyCustomRange}
                disabled={isLoading}
                className='gap-2 bg-slate-900 hover:bg-slate-800'
              >
                {isLoading ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Filter className='h-4 w-4' />
                )}
                اعمال بازه
              </Button>
            </div>
          </div>
        </section>

        <section>
          <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
            <div>
              <h2 className='text-lg font-extrabold text-slate-900'>
                خلاصه کارکرد؛ {periodLabel}
              </h2>
              <p className='mt-1 text-xs text-slate-500'>
                نمایی سریع از حضور و فعالیت ثبت‌شده
              </p>
            </div>
            {isLoading && (
              <span className='flex items-center gap-2 text-xs font-semibold text-sky-700'>
                <Loader2 className='h-4 w-4 animate-spin' />
                در حال به‌روزرسانی
              </span>
            )}
          </div>

          <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
            <SummaryCard
              label='مجموع حضور'
              value={formatMinutes(rangeStats.attendanceMinutes)}
              hint={`${weekTimeline.filter((day) => day.attendance.length).length} روز دارای حضور`}
              icon={<Clock3 className='h-5 w-5' />}
              color='sky'
            />
            <SummaryCard
              label='فعالیت ثبت‌شده'
              value={formatMinutes(rangeStats.taskMinutes)}
              hint={`${tasks.length} فعالیت در این بازه`}
              icon={<ListChecks className='h-5 w-5' />}
              color='violet'
            />
            <SummaryCard
              label='زمان ثبت‌نشده'
              value={formatMinutes(rangeStats.untrackedMinutes)}
              hint='نیازمند تکمیل کارکرد'
              icon={<Hourglass className='h-5 w-5' />}
              color='amber'
            />
            <SummaryCard
              label='پوشش کارکرد'
              value={`${coverage}%`}
              hint='نسبت فعالیت به حضور'
              icon={<Gauge className='h-5 w-5' />}
              color='emerald'
            />
          </div>
        </section>

        <section className='grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'>
          <div className='rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/90'>
            <div className='flex items-start gap-3 border-b border-slate-100 p-5 sm:p-6'>
              <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700'>
                <Plus className='h-5 w-5' />
              </span>
              <div>
                <h2 className='text-lg font-extrabold text-slate-900'>
                  ثبت فعالیت جدید
                </h2>
                <p className='mt-1 text-sm text-slate-500'>
                  زمان و شرح کاری که انجام داده‌اید را وارد کنید.
                </p>
              </div>
            </div>

            <div className='space-y-5 p-5 sm:p-6'>
              <div className='space-y-2'>
                <Label className='font-bold text-slate-700'>تاریخ فعالیت</Label>
                <JalaliDateTimePicker
                  value={taskDate}
                  onChange={(value) => {
                    const nextDate = Array.isArray(value) ? value[0] : value;
                    setTaskDate(nextDate || null);
                  }}
                  format='YYYY/MM/DD'
                  placeholder='انتخاب تاریخ'
                />
                {(selectedTaskDate < appliedStart ||
                  selectedTaskDate > appliedEnd ||
                  appliedStart !== appliedEnd) && (
                  <button
                    type='button'
                    onClick={() => {
                      const selectedDate = taskDate || initialDate;
                      setPeriodPreset('custom');
                      setRangeStart(selectedDate);
                      setRangeEnd(new DateObject(selectedDate));
                      void loadRange(selectedTaskDate, selectedTaskDate);
                    }}
                    className='flex items-center gap-1 text-xs font-bold text-sky-700 transition hover:text-sky-900'
                  >
                    نمایش فقط فعالیت‌های این تاریخ
                    <ArrowLeft className='h-3.5 w-3.5' />
                  </button>
                )}
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-2'>
                  <Label className='font-bold text-slate-700'>از ساعت</Label>
                  <JalaliDateTimePicker
                    value={taskStartTime}
                    onChange={(value) => {
                      const nextTime = Array.isArray(value) ? value[0] : value;
                      setTaskStartTime(nextTime || null);
                    }}
                    disableDayPicker
                    format='HH:mm'
                    placeholder='--:--'
                  />
                </div>
                <div className='space-y-2'>
                  <Label className='font-bold text-slate-700'>تا ساعت</Label>
                  <JalaliDateTimePicker
                    value={taskEndTime}
                    onChange={(value) => {
                      const nextTime = Array.isArray(value) ? value[0] : value;
                      setTaskEndTime(nextTime || null);
                    }}
                    disableDayPicker
                    format='HH:mm'
                    placeholder='--:--'
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='timesheet-project' className='font-bold text-slate-700'>
                  پروژه
                </Label>
                <div className='relative'>
                  <BriefcaseBusiness className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
                  <select
                    id='timesheet-project'
                    value={projectCode}
                    onChange={(event) => {
                      setProjectCode(event.target.value);
                      setSubprojectCode('');
                    }}
                    className='h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-10 pl-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-sky-400 dark:focus:ring-sky-500/20'
                  >
                    {availableProjects.length === 0 && (
                      <option value=''>پروژه فعالی برای این تاریخ نیست</option>
                    )}
                    {availableProjects.map((project) => (
                      <option key={project.code} value={project.code}>
                        {project.title} — {project.code}
                        {formatPeriodLabel(project.start_date, project.end_date)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='timesheet-subproject' className='font-bold text-slate-700'>
                  زیرپروژه
                </Label>
                <div className='relative'>
                  <FolderTree className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
                  <select
                    id='timesheet-subproject'
                    value={subprojectCode}
                    onChange={(event) => setSubprojectCode(event.target.value)}
                    disabled={!availableSubprojects.length}
                    className='h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-10 pl-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-sky-400 dark:focus:ring-sky-500/20 dark:disabled:bg-slate-800 dark:disabled:text-slate-500'
                  >
                    <option value=''>
                      {availableSubprojects.length
                        ? 'بدون زیرپروژه'
                        : 'زیرپروژه فعالی برای این تاریخ نیست'}
                    </option>
                    {availableSubprojects.map((subproject) => (
                      <option key={subproject.code} value={subproject.code}>
                        {subproject.title} — {subproject.code}
                        {formatPeriodLabel(
                          subproject.start_date,
                          subproject.end_date,
                        )}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className='space-y-2'>
                <div className='flex items-center justify-between gap-3'>
                  <Label htmlFor='timesheet-description' className='font-bold text-slate-700'>
                    شرح فعالیت
                  </Label>
                  <span className='text-xs text-slate-400'>
                    {taskName.length} نویسه
                  </span>
                </div>
                <Textarea
                  id='timesheet-description'
                  placeholder='برای مثال: بررسی درخواست‌ها و تکمیل گزارش هفتگی...'
                  value={taskName}
                  onChange={(event) => setTaskName(event.target.value)}
                  className='min-h-[118px] resize-none border-slate-200 bg-slate-50/60 leading-7 focus:bg-white dark:border-slate-600 dark:bg-slate-900/60 dark:focus:bg-slate-900'
                />
              </div>

              <Button
                size='lg'
                onClick={handleAddTask}
                disabled={taskBusy || availableProjects.length === 0}
                className='h-12 w-full gap-2 bg-sky-600 text-base shadow-lg shadow-sky-100 hover:bg-sky-700'
              >
                {taskBusy ? (
                  <Loader2 className='h-5 w-5 animate-spin' />
                ) : (
                  <CheckCircle2 className='h-5 w-5' />
                )}
                ثبت فعالیت
              </Button>
            </div>
          </div>

          <div className='overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/90'>
            <div className='flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6'>
              <div className='flex items-start gap-3'>
                <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700'>
                  <CalendarDays className='h-5 w-5' />
                </span>
                <div>
                  <h2 className='text-lg font-extrabold text-slate-900'>
                    فعالیت‌های بازه
                  </h2>
                  <p className='mt-1 text-sm text-slate-500'>
                    {tasks.length
                      ? `${tasks.length} فعالیت؛ ${periodLabel}`
                      : `هنوز فعالیتی برای بازه ${periodLabel} ثبت نشده است`}
                  </p>
                </div>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={exportCSV}
                disabled={!tasks.length}
                className='gap-2 border-slate-200 bg-white text-slate-700 shadow-none'
              >
                <Download className='h-4 w-4' />
                دریافت CSV
              </Button>
            </div>

            <div className='min-h-[475px]'>
              {isLoading ? (
                <div className='flex min-h-[475px] flex-col items-center justify-center gap-3 text-sm text-slate-500'>
                  <Loader2 className='h-7 w-7 animate-spin text-sky-600' />
                  در حال دریافت فعالیت‌ها...
                </div>
              ) : tasks.length > 0 ? (
                <div className='divide-y divide-slate-100'>
                  {paginatedTasks.map((task, index) => (
                    <article
                      key={task.id}
                      className='group flex gap-4 p-5 transition hover:bg-slate-50/80 sm:p-6'
                    >
                      <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-extrabold text-slate-500 transition group-hover:bg-sky-100 group-hover:text-sky-700'>
                        {(activityPage - 1) * ACTIVITY_PAGE_SIZE + index + 1}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                          <div>
                            <span className='inline-flex rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700'>
                              {task.project_code}
                            </span>
                            {task.subproject_code && (
                              <span className='mr-2 inline-flex rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700'>
                                {task.subproject_code}
                              </span>
                            )}
                            <span className='mr-2 inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500'>
                              {task.work_date}
                            </span>
                            <p className='mt-3 break-words text-sm font-semibold leading-7 text-slate-800'>
                              {task.task_name}
                            </p>
                          </div>
                          <div className='shrink-0 text-right sm:text-left'>
                            <div
                              className='font-mono text-sm font-bold text-slate-700'
                              dir='ltr'
                            >
                              {task.start_time} — {task.end_time}
                            </div>
                            <div className='mt-1 text-xs text-slate-400'>
                              {formatMinutes(task.minutes_spent)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                  {activityPageCount > 1 && (
                    <div className='flex flex-col gap-3 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
                      <p className='text-xs font-semibold text-slate-500'>
                        نمایش {(activityPage - 1) * ACTIVITY_PAGE_SIZE + 1} تا{' '}
                        {Math.min(
                          activityPage * ACTIVITY_PAGE_SIZE,
                          orderedTasks.length,
                        )}{' '}
                        از {orderedTasks.length} فعالیت
                      </p>
                      <div className='flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={() =>
                            setActivityPage((page) => Math.max(1, page - 1))
                          }
                          disabled={activityPage === 1}
                          className='flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40'
                          aria-label='صفحه قبلی'
                        >
                          <ChevronRight className='h-4 w-4' />
                        </button>
                        <span className='min-w-[92px] text-center text-xs font-bold text-slate-700'>
                          صفحه {activityPage} از {activityPageCount}
                        </span>
                        <button
                          type='button'
                          onClick={() =>
                            setActivityPage((page) =>
                              Math.min(activityPageCount, page + 1),
                            )
                          }
                          disabled={activityPage === activityPageCount}
                          className='flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40'
                          aria-label='صفحه بعدی'
                        >
                          <ChevronLeft className='h-4 w-4' />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className='flex min-h-[475px] flex-col items-center justify-center px-6 text-center'>
                  <span className='flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400'>
                    <ListChecks className='h-8 w-8' />
                  </span>
                  <h3 className='mt-5 font-extrabold text-slate-800'>
                    فهرست فعالیت‌ها خالی است
                  </h3>
                  <p className='mt-2 max-w-xs text-sm leading-6 text-slate-500'>
                    در بازه انتخاب‌شده فعالیتی وجود ندارد. بازه دیگری انتخاب کنید یا فعالیت جدیدی ثبت کنید.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className='overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/90'>
          <div className='flex items-start gap-3 border-b border-slate-100 p-5 sm:p-6'>
            <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700'>
              <ArrowUpLeft className='h-5 w-5' />
            </span>
            <div>
              <h2 className='text-lg font-extrabold text-slate-900'>
                نمودار کارکرد بازه
              </h2>
              <p className='mt-1 text-sm text-slate-500'>
                مقایسه بازه حضور و فعالیت‌ها؛ {periodLabel}
              </p>
            </div>
          </div>
          <div className='overflow-x-auto p-4 sm:p-6'>
            {weekTimeline.length > 0 ? (
              <TasksGanttChart days={weekTimeline} />
            ) : (
              <div className='py-12 text-center text-sm text-slate-500'>
                اطلاعاتی برای نمایش وجود ندارد.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
