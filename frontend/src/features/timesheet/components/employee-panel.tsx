import { useMemo, useState, useEffect } from 'react';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import Papa from 'papaparse';
import { Clock3, ClipboardList, Target, Download, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

import { fetchDayTimeline, fetchProjects, fetchSummary, saveCheckIn, saveCheckOut, saveTask, type AttendanceSegment, type DaySummary, type ProjectItem, type TaskItem } from '@/features/timesheet/api';
import { Button } from '@/features/timesheet/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/features/timesheet/components/ui/card';
import { Label } from '@/features/timesheet/components/ui/label';
import { Textarea } from '@/features/timesheet/components/ui/textarea';
import { JalaliDateTimePicker } from '@/features/timesheet/components/jalali-date-time-picker';
import { TasksGanttChart } from '@/features/timesheet/components/tasks-gantt-chart';
import { Logo } from '@/features/timesheet/components/logo';

type WeekTimelineDay = {
  work_date: string;
  attendance: AttendanceSegment[];
  tasks: TaskItem[];
};

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} ساعت و ${m} دقیقه`;
}

function mapErrorToPersian(errorText: string): string {
  const dictionary: Record<string, string> = {
    'Employee must submit check-in first': 'ابتدا باید ورود ثبت شود.',
    'Task time must be within an active check-in period.': 'ساعت تسک باید در بازه حضور (ورود و خروج) باشد.',
    'End time cannot be earlier than start time': 'ساعت پایان نمی تواند قبل از ساعت شروع باشد.',
  };
  return dictionary[errorText] ?? errorText;
}

function extractApiError(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (typeof err?.message === 'string') return err.message;
  return fallback;
}

export function EmployeePanel(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const employeeId = user ? String(user.id) : null;
  const fullName = user?.display_name || user?.username || null;
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [taskDate, setTaskDate] = useState<DateObject | null>(null);
  const [taskStartTime, setTaskStartTime] = useState<DateObject | null>(null);
  const [taskEndTime, setTaskEndTime] = useState<DateObject | null>(null);
  const [projectCode, setProjectCode] = useState('');
  const [taskName, setTaskName] = useState('');

  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [weekTimeline, setWeekTimeline] = useState<WeekTimelineDay[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [activeDate, setActiveDate] = useState<string>('');

  const effectiveDate = useMemo(() => {
    const fromTaskDate = taskDate?.format('YYYY/MM/DD') ?? '';
    return activeDate || fromTaskDate || new DateObject({ calendar: persian, locale: persian_fa }).format('YYYY/MM/DD');
  }, [activeDate, taskDate]);

  const activeDateLabel = effectiveDate || 'روز انتخاب شده';

  useEffect(() => {
    refreshDayData(effectiveDate);
  }, []); // trigger once on mount or when auth changed

  useEffect(() => {
    (async () => {
      try {
        const rows = await fetchProjects();
        setProjects(rows);
        if (rows.length > 0) {
          setProjectCode(rows[0].code);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  async function refreshDayData(workDate: string): Promise<void> {
    if (!workDate) return;
    try {
      const anchor = new DateObject({ date: workDate, format: 'YYYY/MM/DD', calendar: persian, locale: persian_fa });
      const dates = Array.from({ length: 7 }, (_, idx) => {
        const dt = new DateObject(anchor);
        dt.add(-idx, 'day');
        return dt.format('YYYY/MM/DD');
      }).reverse();

      const [nextSummary, timelines] = await Promise.all([
        fetchSummary(workDate),
        Promise.all(dates.map((d) => fetchDayTimeline(d))),
      ]);

      setSummary(nextSummary);
      setTasks((timelines.find((t) => t.work_date === workDate)?.tasks) || []);
      setWeekTimeline(
        timelines.map((t) => ({
          work_date: t.work_date,
          attendance: t.attendance || [],
          tasks: t.tasks || [],
        }))
      );
      setActiveDate(workDate);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleToggleAttendance(): Promise<void> {
    setError('');
    setStatus('');
    try {
      const now = new DateObject({ calendar: persian, locale: persian_fa });
      const currentWorkDate = now.format('YYYY/MM/DD');
      const currentTime = now.format('HH:mm');

      if (summary?.is_currently_checked_in) {
        await saveCheckOut({ work_date: currentWorkDate, check_out_time: currentTime });
        setStatus('خروج با موفقیت ثبت شد.');
      } else {
        await saveCheckIn({ work_date: currentWorkDate, check_in_time: currentTime });
        setStatus('ورود با موفقیت ثبت شد.');
      }
      await refreshDayData(currentWorkDate);
    } catch (err: any) {
      const rawError = extractApiError(err, summary?.is_currently_checked_in ? 'Failed to check-out' : 'Failed to check-in');
      setError(mapErrorToPersian(rawError));
    }
  }

  function exportCSV() {
    const csvContent = tasks.map(t => ({
      تاریخ: effectiveDate,
      'ساعت شروع': t.start_time,
      'ساعت پایان': t.end_time,
      'مدت زمان (دقیقه)': t.minutes_spent,
      'جزئیات تسک': t.task_name
    }));
    const csv = Papa.unparse(csvContent);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `tasks_${effectiveDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleAddTask(): Promise<void> {
    setError('');
    setStatus('');

    const workDate = taskDate?.format('YYYY/MM/DD');
    const startTime = taskStartTime?.format('HH:mm');
    const endTime = taskEndTime?.format('HH:mm');

    if (!workDate || !startTime || !endTime || !taskName.trim() || !projectCode.trim()) {
      setError('تمامی فیلدها الزامی است.');
      return;
    }

    try {
      await saveTask({
        work_date: workDate,
        project_code: projectCode,
        task_name: taskName,
        start_time: startTime,
        end_time: endTime,
      });

      setStatus('تسک با موفقیت ثبت شد.');
      setTaskName('');
      setTaskStartTime(null);
      setTaskEndTime(null);

      await refreshDayData(workDate);
    } catch (err: any) {
      const rawError = extractApiError(err, 'Failed to save task');
      setError(mapErrorToPersian(rawError));
    }
  }

  return (
    <div className='min-h-screen p-4 sm:p-8 bg-zinc-100 dark:bg-zinc-900 font-timesheet' dir='rtl'>
      <div className='max-w-6xl mx-auto space-y-6 sm:space-y-8'>
        <Logo />
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h1 className='text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50'>
              پیشخوان کارمند
            </h1>
            <p className='mt-2 text-zinc-600 dark:text-zinc-400'>
              ثبت حضور و غیاب، مدیریت وظایف و گزارش روزانه
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <span className='px-4 py-2 font-medium bg-white rounded-lg shadow-sm text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200'>
              کارمند: {fullName || employeeId}
            </span>
            <Button variant='outline' onClick={handleLogout}>خروج از حساب</Button>
          </div>
        </div>

        {error && (
          <div className='p-4 text-sm font-semibold text-red-800 bg-red-100 border border-red-200 rounded-lg dark:bg-red-900/30 dark:text-red-200 dark:border-red-800'>
            {error}
          </div>
        )}
        {status && (
          <div className='p-4 text-sm font-semibold text-green-800 bg-green-100 border border-green-200 rounded-lg dark:bg-green-900/30 dark:text-green-200 dark:border-green-800'>
            {status}
          </div>
        )}

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          <div className='space-y-6 lg:col-span-1'>
            <Card className='shadow-sm dark:bg-zinc-800'>
              <CardHeader className='pb-4 border-b dark:border-zinc-700 border-zinc-100'>
                <CardTitle className='flex items-center gap-2 text-xl'>
                  <Navigation className='w-5 h-5 text-blue-500' />
                  ثبت خروج و ورود
                </CardTitle>
                <CardDescription className='dark:text-zinc-400'>
                  نمایش وضعیت فعلی سیستم و امکان تغییر آن
                </CardDescription>
              </CardHeader>
              <CardContent className='pt-6'>
                <div className='flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl dark:border-zinc-700 border-zinc-200'>
                  <div className='mb-4 text-center'>
                    <div className='mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400'>وضعیت فعلی</div>
                    <div className={`text-2xl font-bold ${summary?.is_currently_checked_in ? 'text-green-600 dark:text-green-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      {summary?.is_currently_checked_in ? 'آنلاین (حاضر)' : 'آفلاین (خارج شده)'}
                    </div>
                  </div>
                  <Button
                    size='lg'
                    className={`w-full max-w-[250px] font-bold text-white transition-all shadow-md active:scale-95 ${summary?.is_currently_checked_in ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                    onClick={handleToggleAttendance}
                  >
                    {summary?.is_currently_checked_in ? 'پایان کار (ثبت خروج)' : 'شروع کار (ثبت ورود)'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className='shadow-sm flex flex-col h-[600px] dark:bg-zinc-800'>
              <CardHeader className='flex-none pb-4 border-b dark:border-zinc-700 border-zinc-100'>
                <CardTitle className='flex items-center gap-2 text-xl'>
                  <ClipboardList className='w-5 h-5 text-purple-500' />
                  ثبت کارکرد جدید
                </CardTitle>
                <CardDescription className='dark:text-zinc-400'>
                  تسک‌های انجام شده در روز مورد نظر را ثبت کنید
                </CardDescription>
              </CardHeader>
              <CardContent className='flex flex-col flex-1 gap-6 pt-6 overflow-y-auto min-h-0'>
                <div className='space-y-2'>
                  <Label className='text-sm font-semibold dark:text-zinc-200'>تاریخ تسک</Label>
                  <JalaliDateTimePicker
                    value={taskDate}
                    onChange={(val: any) => setTaskDate(val)}
                    format="YYYY/MM/DD"
                    placeholder='انتخاب تاریخ'
                  />
                  {taskDate && (
                    <Button variant='outline' size='sm' className='h-auto p-0 mt-1 text-xs text-blue-600 dark:text-blue-400' onClick={() => refreshDayData(taskDate.format('YYYY/MM/DD'))}>
                      مشاهده اطلاعات این روز
                    </Button>
                  )}
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label className='text-sm font-semibold dark:text-zinc-200'>ساعت شروع</Label>
                    <JalaliDateTimePicker
                      value={taskStartTime}
                      onChange={(val: any) => setTaskStartTime(val)}
                      disableDayPicker={true}
                      format="HH:mm"
                      placeholder='--:--'
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label className='text-sm font-semibold dark:text-zinc-200'>ساعت پایان</Label>
                    <JalaliDateTimePicker
                      value={taskEndTime}
                      onChange={(val: any) => setTaskEndTime(val)}
                      disableDayPicker={true}
                      format="HH:mm"
                      placeholder='--:--'
                    />
                  </div>
                </div>

                <div className='flex flex-col h-full space-y-2'>
                  <Label className='text-sm font-semibold dark:text-zinc-200'>کد پروژه</Label>
                  <select
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    className='flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100'
                  >
                    {projects.length === 0 && <option value=''>پروژه‌ای تعریف نشده</option>}
                    {projects.map((project) => (
                      <option key={project.code} value={project.code}>
                        {project.code} - {project.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='flex flex-col h-full space-y-2'>
                  <Label className='text-sm font-semibold dark:text-zinc-200'>جزئیات تسک</Label>
                  <Textarea
                    placeholder='این بازه زمانی صرف چه کاری شد؟'
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className='flex-1 h-full min-h-[120px] resize-none dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100'
                  />
                </div>

                <Button className='w-full mt-auto font-bold shadow-sm' size='lg' onClick={handleAddTask}>
                  ثبت خروجی کار
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className='grid grid-rows-[auto_1fr] gap-6 lg:col-span-2'>
            <Card className='shadow-sm dark:bg-zinc-800'>
              <CardHeader className='pb-4 border-b dark:border-zinc-700 border-zinc-100'>
                <CardTitle className='flex items-center gap-2 text-xl'>
                  <Target className='w-5 h-5 text-orange-500' />
                  خلاصه عملکرد ({activeDateLabel})
                </CardTitle>
              </CardHeader>
              <CardContent className='pt-6'>
                {summary ? (
                  <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
                    <div className='p-4 border rounded-xl bg-slate-50 dark:bg-zinc-900 dark:border-zinc-700'>
                      <div className='text-sm font-medium text-slate-500 dark:text-slate-400'>مجموع حضور</div>
                      <div className='mt-1 text-xl font-bold text-slate-800 dark:text-slate-200'>
                        {formatMinutes(summary.attendance_minutes)}
                      </div>
                    </div>
                    <div className='p-4 border rounded-xl bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'>
                      <div className='text-sm font-medium text-blue-600 dark:text-blue-400'>کارکرد ثبت شده</div>
                      <div className='mt-1 text-xl font-bold text-blue-700 dark:text-blue-300'>
                        {formatMinutes(summary.task_minutes)}
                      </div>
                    </div>
                    <div className='p-4 border rounded-xl bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800'>
                      <div className='text-sm font-medium text-red-600 dark:text-red-400'>کارکرد ثبت نشده</div>
                      <div className='mt-1 text-xl font-bold text-red-700 dark:text-red-300'>
                        {formatMinutes(summary.untracked_minutes)}
                      </div>
                    </div>
                    <div className='p-4 border rounded-xl bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800'>
                      <div className='text-sm font-medium text-green-600 dark:text-green-400'>راندمان کاری</div>
                      <div className='mt-1 text-xl font-bold text-green-700 dark:text-green-300'>
                        {summary.efficiency_percent}%
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className='py-8 text-center text-zinc-500 dark:text-zinc-400'>
                    اطلاعاتی برای این روز یافت نشد.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className='shadow-sm flex flex-col min-h-[400px] max-h-[800px] overflow-hidden dark:bg-zinc-800'>
              <CardHeader className='flex-none pb-4 border-b dark:border-zinc-700 border-zinc-100'>
                <div className='flex items-center justify-between'>
                  <CardTitle className='flex items-center gap-2 text-xl'>
                    <Clock3 className='w-5 h-5 text-teal-500' />
                    تسک‌های ثبت شده ({tasks.length})
                  </CardTitle>
                  <Button variant='outline' size='sm' onClick={exportCSV} className='dark:text-zinc-200 dark:border-zinc-600'>
                    <Download className='w-4 h-4 ml-2' />
                    خروجی CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className='flex flex-col flex-1 p-0 min-h-0'>
                {weekTimeline.length > 0 ? (
                  <div className='flex flex-col h-full'>
                    <div className='flex-1 overflow-x-auto min-h-[150px] p-4 lg:p-6'>
                      <TasksGanttChart days={weekTimeline} />
                    </div>
                    <div className='flex-1 p-0 overflow-y-auto border-t dark:border-zinc-700 border-zinc-100 min-h-[250px]'>
                      <div className='divide-y dark:divide-zinc-700 divide-zinc-100'>
                        {tasks.map((task, index) => (
                          <div
                            key={task.id}
                            className='flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                          >
                            <div className='flex items-center gap-3 sm:w-48 shrink-0'>
                              <div className='flex items-center justify-center w-8 h-8 text-sm font-bold rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'>
                                {index + 1}
                              </div>
                              <div className='flex flex-col'>
                                <span className='font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                                  {task.start_time} - {task.end_time}
                                </span>
                                <span className='text-xs text-zinc-500 dark:text-zinc-400'>
                                  {task.minutes_spent} دقیقه
                                </span>
                              </div>
                            </div>
                            <div className='text-sm leading-relaxed text-zinc-700 dark:text-zinc-300'>
                              <span className='ml-2 inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'>
                                {task.project_code}
                              </span>
                              {task.task_name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className='flex items-center justify-center flex-1 py-12 text-zinc-500 dark:text-zinc-400'>
                    هیچ تسکی برای این روز ثبت نشده است.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

