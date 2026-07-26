import { useEffect, useMemo, useState } from 'react';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { adminCreateProject, adminDeleteProject, fetchAdminDayRecords, fetchAdminProjects, type AdminDayRecords, type ProjectItem } from '@/features/timesheet/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/features/timesheet/components/ui/card';
import { Button } from '@/features/timesheet/components/ui/button';
import { Label } from '@/features/timesheet/components/ui/label';
import { Input } from '@/features/timesheet/components/ui/input';
import { JalaliDateTimePicker } from '@/features/timesheet/components/jalali-date-time-picker';
import { Logo } from '@/features/timesheet/components/logo';

function asPersianDate(value: DateObject | null): string {
  if (value) return value.format('YYYY/MM/DD');
  return new DateObject({ calendar: persian, locale: persian_fa }).format('YYYY/MM/DD');
}

export function AdminPanel(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const employeeId = user ? String(user.id) : null;
  const fullName = user?.display_name || user?.username || null;
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const [selectedDate, setSelectedDate] = useState<DateObject | null>(null);
  const [records, setRecords] = useState<AdminDayRecords | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [viewMode, setViewMode] = useState<'all' | 'employee' | 'project'>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [minMinutes, setMinMinutes] = useState<string>('');

  const [projectCode, setProjectCode] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectListSearch, setProjectListSearch] = useState('');

  const effectiveDate = useMemo(() => asPersianDate(selectedDate), [selectedDate]);
  const employees = useMemo(() => {
    const map = new Map<string, string>();
    (records?.attendance || []).forEach((row) => {
      map.set(row.employee_id, row.full_name || row.employee_id);
    });
    (records?.tasks || []).forEach((row) => {
      map.set(row.employee_id, row.full_name || row.employee_id);
    });
    return Array.from(map.entries())
      .map(([employee_id, full_name]) => ({ employee_id, full_name }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [records]);

  const projectFilterOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => set.add(p.code));
    (records?.tasks || []).forEach((t) => set.add(t.project_code));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projects, records]);


  const filteredProjectList = useMemo(() => {
    const q = projectListSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      return (
        p.code.toLowerCase().includes(q)
        || (p.title || '').toLowerCase().includes(q)
      );
    });
  }, [projects, projectListSearch]);

  const filteredTasks = useMemo(() => {
    let rows = [...(records?.tasks || [])];

    if (selectedEmployee !== 'all') {
      rows = rows.filter((r) => r.employee_id === selectedEmployee);
    }
    if (selectedProject !== 'all') {
      rows = rows.filter((r) => r.project_code === selectedProject);
    }

    const minValue = Number(minMinutes || '0');
    if (!Number.isNaN(minValue) && minValue > 0) {
      rows = rows.filter((r) => r.minutes_spent >= minValue);
    }

    const q = searchText.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        return (
          (r.full_name || '').toLowerCase().includes(q)
          || r.employee_id.toLowerCase().includes(q)
          || r.project_code.toLowerCase().includes(q)
          || r.task_name.toLowerCase().includes(q)
        );
      });
    }

    return rows;
  }, [records, selectedEmployee, selectedProject, minMinutes, searchText]);

  const filteredAttendance = useMemo(() => {
    let rows = [...(records?.attendance || [])];
    if (selectedEmployee !== 'all') {
      rows = rows.filter((r) => r.employee_id === selectedEmployee);
    }
    return rows;
  }, [records, selectedEmployee]);

  const employeeSummary = useMemo(() => {
    const attendanceMinutesByEmployee = new Map<string, number>();
    const taskMinutesByEmployee = new Map<string, number>();
    const nameByEmployee = new Map<string, string>();

    filteredAttendance.forEach((row) => {
      nameByEmployee.set(row.employee_id, row.full_name || row.employee_id);
      if (!row.check_in_time || !row.check_out_time) return;
      const inParts = row.check_in_time.split(':').map(Number);
      const outParts = row.check_out_time.split(':').map(Number);
      if (inParts.length !== 2 || outParts.length !== 2) return;
      const inMin = inParts[0] * 60 + inParts[1];
      const outMin = outParts[0] * 60 + outParts[1];
      if (outMin >= inMin) {
        attendanceMinutesByEmployee.set(
          row.employee_id,
          (attendanceMinutesByEmployee.get(row.employee_id) || 0) + (outMin - inMin)
        );
      }
    });

    filteredTasks.forEach((row) => {
      nameByEmployee.set(row.employee_id, row.full_name || row.employee_id);
      taskMinutesByEmployee.set(
        row.employee_id,
        (taskMinutesByEmployee.get(row.employee_id) || 0) + row.minutes_spent
      );
    });

    const allEmployees = new Set<string>([
      ...Array.from(attendanceMinutesByEmployee.keys()),
      ...Array.from(taskMinutesByEmployee.keys()),
      ...Array.from(nameByEmployee.keys()),
    ]);

    return Array.from(allEmployees)
      .map((employee_id) => {
        const attendance_minutes = attendanceMinutesByEmployee.get(employee_id) || 0;
        const task_minutes = taskMinutesByEmployee.get(employee_id) || 0;
        const efficiency = attendance_minutes > 0 ? Math.round((task_minutes / attendance_minutes) * 100) : 0;
        return {
          employee_id,
          full_name: nameByEmployee.get(employee_id) || employee_id,
          attendance_minutes,
          task_minutes,
          efficiency,
        };
      })
      .sort((a, b) => b.task_minutes - a.task_minutes);
  }, [filteredAttendance, filteredTasks]);

  const projectSummary = useMemo(() => {
    const grouped = new Map<string, { project_code: string; minutes: number; tasks: number; employees: Set<string> }>();
    filteredTasks.forEach((row) => {
      const current = grouped.get(row.project_code) || { project_code: row.project_code, minutes: 0, tasks: 0, employees: new Set<string>() };
      current.minutes += row.minutes_spent;
      current.tasks += 1;
      current.employees.add(row.employee_id);
      grouped.set(row.project_code, current);
    });
    return Array.from(grouped.values()).map((x) => ({
      project_code: x.project_code,
      minutes: x.minutes,
      tasks: x.tasks,
      employees: x.employees.size,
    })).sort((a, b) => b.minutes - a.minutes);
  }, [filteredTasks]);

  const analytics = useMemo(() => {
    const totalTaskMinutes = filteredTasks.reduce((sum, row) => sum + row.minutes_spent, 0);
    const activeEmployees = new Set(filteredTasks.map((row) => row.employee_id)).size;
    const avgTaskMinutes = filteredTasks.length > 0 ? Math.round(totalTaskMinutes / filteredTasks.length) : 0;
    return {
      totalTaskMinutes,
      activeEmployees,
      taskCount: filteredTasks.length,
      avgTaskMinutes,
    };
  }, [filteredTasks]);

  async function loadProjects(): Promise<void> {
    try {
      const rows = await fetchAdminProjects();
      setProjects(rows);
    } catch (err) {
      console.error(err);
    }
  }


  async function loadRecords(workDate: string): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const next = await fetchAdminDayRecords(workDate);
      setRecords(next);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'خطا در دریافت اطلاعات روزانه')
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords(effectiveDate);
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject !== 'all' && !projectFilterOptions.includes(selectedProject)) {
      setSelectedProject('all');
    }
  }, [projectFilterOptions, selectedProject]);

  useEffect(() => {
    if (selectedEmployee !== 'all' && !employees.some((e) => e.employee_id === selectedEmployee)) {
      setSelectedEmployee('all');
    }
  }, [employees, selectedEmployee]);

  async function handleCreateProject(): Promise<void> {
    setError('');
    setStatus('');
    if (!projectCode.trim()) {
      setError('کد پروژه الزامی است.');
      return;
    }

    try {
      await adminCreateProject({ code: projectCode.trim(), title: projectTitle.trim() || undefined });
      setStatus('پروژه جدید با موفقیت ایجاد شد.');
      setProjectCode('');
      setProjectTitle('');
      await loadProjects();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'خطا در ایجاد پروژه جدید');
    }
  }

  async function handleDeleteProject(project: ProjectItem): Promise<void> {
    setError('');
    setStatus('');
    const accepted = window.confirm(`آیا از حذف پروژه ${project.code} مطمئن هستید؟ تسک های وابسته به GENERAL منتقل می شوند.`);
    if (!accepted) return;

    try {
      const result = await adminDeleteProject(project.code);
      setStatus(`پروژه حذف شد. تعداد ${result.reassigned_tasks} تسک به GENERAL منتقل شد.`);
      await Promise.all([loadProjects(), loadRecords(effectiveDate)]);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'خطا در حذف پروژه');
    }
  }

  return (
    <div className='min-h-screen bg-zinc-100 p-4 font-timesheet dark:bg-zinc-900 sm:p-8' dir='rtl'>
      <div className='mx-auto max-w-7xl space-y-6'>
        <Logo />
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h1 className='text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100'>پنل ادمین</h1>
            <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>مانیتورینگ حضور و غیاب، تسک‌ها و پروژه‌ها</p>
          </div>
          <div className='flex items-center gap-2'>
            <span className='rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'>
              {fullName || employeeId}
            </span>
            <Button variant='outline' onClick={handleLogout}>خروج</Button>
          </div>
        </div>

        {error && <div className='rounded-lg border border-red-200 bg-red-100 p-3 text-sm font-semibold text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200'>{error}</div>}
        {status && <div className='rounded-lg border border-green-200 bg-green-100 p-3 text-sm font-semibold text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200'>{status}</div>}

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          <Card className='shadow-sm dark:bg-zinc-800 lg:col-span-1'>
            <CardHeader>
              <CardTitle>مدیریت پروژه‌ها</CardTitle>
              <CardDescription>ایجاد، جستجو و حذف پروژه‌های تایم شیت</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <h3 className='text-sm font-bold text-zinc-700 dark:text-zinc-300'>افزودن پروژه</h3>
                <div className='space-y-1'>
                  <Label>کد پروژه</Label>
                  <Input value={projectCode} onChange={(e) => setProjectCode(e.target.value.toUpperCase())} placeholder='PRJ-001' />
                </div>
                <div className='space-y-1'>
                  <Label>عنوان پروژه (اختیاری)</Label>
                  <Input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder='عنوان پروژه' />
                </div>
                <Button variant='outline' className='w-full' onClick={handleCreateProject}>ایجاد پروژه</Button>
                <Input
                  value={projectListSearch}
                  onChange={(e) => setProjectListSearch(e.target.value)}
                  placeholder='جستجو پروژه: کد یا عنوان'
                />
                <div className='max-h-44 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700'>
                  <table className='w-full text-xs'>
                    <thead className='bg-zinc-50 dark:bg-zinc-700/50'>
                      <tr>
                        <th className='p-2 text-right'>کد</th>
                        <th className='p-2 text-right'>عنوان</th>
                        <th className='p-2 text-right'>عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProjectList.map((p) => (
                        <tr key={p.code} className='border-t border-zinc-100 dark:border-zinc-700'>
                          <td className='p-2 font-mono'>{p.code}</td>
                          <td className='p-2'>{p.title || p.code}</td>
                          <td className='p-2'>
                            <Button
                              size='sm'
                              variant='outline'
                              className='h-8 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30'
                              onClick={() => handleDeleteProject(p)}
                              disabled={p.code === 'GENERAL'}
                            >
                              حذف
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className='shadow-sm dark:bg-zinc-800 lg:col-span-2'>
            <CardHeader>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <CardTitle>مانیتورینگ روزانه</CardTitle>
                  <CardDescription>نمایش پروژه‌ها بر اساس کد پروژه، کارمند یا نمای کلی</CardDescription>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='w-44'>
                    <JalaliDateTimePicker value={selectedDate} onChange={(v: any) => setSelectedDate(v)} format='YYYY/MM/DD' placeholder='انتخاب تاریخ' />
                  </div>
                  <Button variant='outline' onClick={() => loadRecords(asPersianDate(selectedDate))} disabled={loading}>مشاهده</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 sm:grid-cols-3'>
                <div className='space-y-1'>
                  <Label>نوع نمایش</Label>
                  <select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as 'all' | 'employee' | 'project')}
                    className='flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm'
                  >
                    <option value='all'>نمای کلی</option>
                    <option value='employee'>بر اساس کارمند</option>
                    <option value='project'>بر اساس کد پروژه</option>
                  </select>
                </div>
                <div className='space-y-1'>
                  <Label>کارمند</Label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className='flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm'
                  >
                    <option value='all'>همه</option>
                    {employees.map((emp) => (
                      <option key={emp.employee_id} value={emp.employee_id}>{emp.full_name} ({emp.employee_id})</option>
                    ))}
                  </select>
                </div>
                <div className='space-y-1'>
                  <Label>کد پروژه</Label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className='flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm'
                  >
                    <option value='all'>همه</option>
                    {projectFilterOptions.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className='grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 sm:grid-cols-2'>
                <div className='space-y-1'>
                  <Label>جستجو (کارمند / پروژه / تسک)</Label>
                  <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder='مثلا: Admin User یا PRJ-001' />
                </div>
                <div className='space-y-1'>
                  <Label>حداقل دقیقه تسک</Label>
                  <Input value={minMinutes} onChange={(e) => setMinMinutes(e.target.value.replace(/[^0-9]/g, ''))} placeholder='مثلا 30' />
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                <div className='rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900'>
                  <div className='text-xs text-zinc-500 dark:text-zinc-400'>تعداد تسک</div>
                  <div className='mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100'>{analytics.taskCount}</div>
                </div>
                <div className='rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900'>
                  <div className='text-xs text-zinc-500 dark:text-zinc-400'>مجموع دقیقه</div>
                  <div className='mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100'>{analytics.totalTaskMinutes}</div>
                </div>
                <div className='rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900'>
                  <div className='text-xs text-zinc-500 dark:text-zinc-400'>کارمند فعال</div>
                  <div className='mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100'>{analytics.activeEmployees}</div>
                </div>
                <div className='rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900'>
                  <div className='text-xs text-zinc-500 dark:text-zinc-400'>میانگین دقیقه/تسک</div>
                  <div className='mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100'>{analytics.avgTaskMinutes}</div>
                </div>
              </div>

              {(viewMode === 'all' || viewMode === 'employee') && (
                <div>
                  <h3 className='mb-2 text-sm font-bold text-zinc-700 dark:text-zinc-300'>تحلیل عملکرد کارمندان ({employeeSummary.length})</h3>
                  <div className='max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700'>
                    <table className='w-full text-sm'>
                      <thead className='bg-zinc-50 dark:bg-zinc-700/50'>
                        <tr>
                          <th className='p-2 text-right'>کارمند</th>
                          <th className='p-2 text-right'>مجموع حضور (دقیقه)</th>
                          <th className='p-2 text-right'>مجموع تسک (دقیقه)</th>
                          <th className='p-2 text-right'>بهره وری</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeSummary.map((row) => (
                          <tr key={`emp-sum-${row.employee_id}`} className='border-t border-zinc-100 dark:border-zinc-700'>
                            <td className='p-2'>{row.full_name} ({row.employee_id})</td>
                            <td className='p-2'>{row.attendance_minutes}</td>
                            <td className='p-2'>{row.task_minutes}</td>
                            <td className='p-2'>{row.efficiency}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(viewMode === 'all' || viewMode === 'project') && (
                <div>
                <h3 className='mb-2 text-sm font-bold text-zinc-700 dark:text-zinc-300'>خلاصه پروژه‌ها ({projectSummary.length})</h3>
                <div className='max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700'>
                  <table className='w-full text-sm'>
                    <thead className='bg-zinc-50 dark:bg-zinc-700/50'>
                      <tr>
                        <th className='p-2 text-right'>کد پروژه</th>
                        <th className='p-2 text-right'>تعداد تسک</th>
                        <th className='p-2 text-right'>کارمند فعال</th>
                        <th className='p-2 text-right'>مجموع دقیقه</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectSummary.map((row) => (
                        <tr key={`sum-${row.project_code}`} className='border-t border-zinc-100 dark:border-zinc-700'>
                          <td className='p-2 font-mono'>{row.project_code}</td>
                          <td className='p-2'>{row.tasks}</td>
                          <td className='p-2'>{row.employees}</td>
                          <td className='p-2'>{row.minutes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              )}

              <div>
                <h3 className='mb-2 text-sm font-bold text-zinc-700 dark:text-zinc-300'>حضور و غیاب ({filteredAttendance.length || 0})</h3>
                <div className='max-h-60 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700'>
                  <table className='w-full text-sm'>
                    <thead className='bg-zinc-50 dark:bg-zinc-700/50'>
                      <tr>
                        <th className='p-2 text-right'>کاربر</th>
                        <th className='p-2 text-right'>کد پرسنلی</th>
                        <th className='p-2 text-right'>ورود</th>
                        <th className='p-2 text-right'>خروج</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.map((row) => (
                        <tr key={`att-${row.id}`} className='border-t border-zinc-100 dark:border-zinc-700'>
                          <td className='p-2'>{row.full_name}</td>
                          <td className='p-2'>{row.employee_id}</td>
                          <td className='p-2'>{row.check_in_time || '-'}</td>
                          <td className='p-2'>{row.check_out_time || 'در حال حضور'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className='mb-2 text-sm font-bold text-zinc-700 dark:text-zinc-300'>تسک‌ها ({filteredTasks.length || 0})</h3>
                <div className='max-h-72 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700'>
                  <table className='w-full text-sm'>
                    <thead className='bg-zinc-50 dark:bg-zinc-700/50'>
                      <tr>
                        <th className='p-2 text-right'>کاربر</th>
                        <th className='p-2 text-right'>کد پروژه</th>
                        <th className='p-2 text-right'>تسک</th>
                        <th className='p-2 text-right'>شروع</th>
                        <th className='p-2 text-right'>پایان</th>
                        <th className='p-2 text-right'>مدت (دقیقه)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((row) => (
                        <tr key={`task-${row.id}`} className='border-t border-zinc-100 dark:border-zinc-700'>
                          <td className='p-2'>{row.full_name}</td>
                          <td className='p-2 font-mono'>{row.project_code}</td>
                          <td className='p-2'>{row.task_name}</td>
                          <td className='p-2'>{row.start_time}</td>
                          <td className='p-2'>{row.end_time}</td>
                          <td className='p-2'>{row.minutes_spent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
