import React from 'react';

type AttendanceSegment = {
  id: number;
  check_in_time: string;
  check_out_time: string | null;
};

type TaskSegment = {
  id: number;
  task_name: string;
  start_time: string;
  end_time: string;
  minutes_spent: number;
};

type GanttProps = {
  days: Array<{
    work_date: string;
    attendance: AttendanceSegment[];
    tasks: TaskSegment[];
  }>;
};

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function clampMinute(value: number): number {
  return Math.max(0, Math.min(24 * 60, value));
}

type HoverTask = {
  x: number;
  y: number;
  workDate: string;
  taskName: string;
  duration: number;
  label: string;
};

export function TasksGanttChart({ days }: GanttProps): JSX.Element {
  if (!days.length) {
    return <div className='p-4 text-center text-muted-foreground'>برای نمایش تایم‌لاین ابتدا حضور یا تسک ثبت کنید.</div>;
  }

  const [hoverTask, setHoverTask] = React.useState<HoverTask | null>(null);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const dayRows = days.map((day) => {
    const attendanceRanges = day.attendance
      .filter((item) => !!item.check_in_time)
      .map((item) => {
        const start = clampMinute(parseTimeToMinutes(item.check_in_time));
        const end = clampMinute(item.check_out_time ? parseTimeToMinutes(item.check_out_time) : nowMinutes);
        return { id: item.id, start: Math.min(start, end), end: Math.max(start, end), label: `${item.check_in_time} - ${item.check_out_time ?? 'اکنون'}` };
      });

    const taskRanges = day.tasks.map((item) => {
      const start = clampMinute(parseTimeToMinutes(item.start_time));
      const end = clampMinute(parseTimeToMinutes(item.end_time));
      return {
        id: item.id,
        title: item.task_name,
        start: Math.min(start, end),
        end: Math.max(start, end),
        duration: Math.max(item.minutes_spent, Math.max(end - start, 0)),
        label: `${item.start_time} - ${item.end_time}`,
      };
    });

    return {
      workDate: day.work_date,
      attendanceRanges,
      taskRanges,
    };
  });

  const startCandidates = [
    ...dayRows.flatMap((d) => d.attendanceRanges.map((a) => a.start)),
    ...dayRows.flatMap((d) => d.taskRanges.map((t) => t.start)),
  ];
  const endCandidates = [
    ...dayRows.flatMap((d) => d.attendanceRanges.map((a) => a.end)),
    ...dayRows.flatMap((d) => d.taskRanges.map((t) => t.end)),
  ];

  const minStart = startCandidates.length ? Math.min(...startCandidates) : 8 * 60;
  const maxEnd = endCandidates.length ? Math.max(...endCandidates) : 17 * 60;

  const domainMin = clampMinute(Math.floor((minStart - 30) / 30) * 30);
  const domainMax = clampMinute(Math.ceil((maxEnd + 30) / 30) * 30);
  const domainSpan = Math.max(30, domainMax - domainMin);

  const hourTicks: number[] = [];
  const firstTick = Math.floor(domainMin / 60) * 60;
  for (let m = firstTick; m <= domainMax; m += 60) {
    hourTicks.push(m);
  }

  return (
    <div className='w-full rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900' dir='ltr'>
      <div className='mb-3 flex flex-wrap items-center gap-4 text-xs'>
        <div className='flex items-center gap-2'>
          <span className='inline-block h-3 w-6 rounded-full bg-blue-300 ring-1 ring-blue-500' />
          <span className='text-zinc-700 dark:text-zinc-300'>بازه حضور</span>
        </div>
        <div className='flex items-center gap-2'>
          <span className='inline-block h-3 w-6 rounded-full bg-pink-300 ring-1 ring-pink-500' />
          <span className='text-zinc-700 dark:text-zinc-300'>بازه تسک</span>
        </div>
      </div>

      <div className='relative overflow-x-auto'>
        <div className='relative min-w-[760px]'>
          <div className='relative mb-2 h-7 border-b border-zinc-200 dark:border-zinc-700'>
            {hourTicks.map((tick) => {
              const left = ((tick - domainMin) / domainSpan) * 100;
              return (
                <div key={tick} className='absolute top-0 h-full' style={{ left: `${left}%` }}>
                  <div className='-translate-x-1/2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400'>{formatMinutesToTime(tick)}</div>
                </div>
              );
            })}
          </div>

          <div className='overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700'>
            {dayRows.map((day, idx) => (
              <div key={day.workDate} className={`grid grid-cols-[1fr_180px] ${idx % 2 === 0 ? 'bg-zinc-50 dark:bg-zinc-800/60' : 'bg-white dark:bg-zinc-900/60'}`}>
                <div className='relative h-14 border-l border-zinc-200/80 dark:border-zinc-700/80'>
                  {hourTicks.map((tick) => {
                    const left = ((tick - domainMin) / domainSpan) * 100;
                    return <div key={`grid-${day.workDate}-${tick}`} className='absolute bottom-0 top-0 border-r border-zinc-200/80 dark:border-zinc-700/80' style={{ left: `${left}%` }} />;
                  })}

                  {day.attendanceRanges.map((segment) => {
                    const left = ((segment.start - domainMin) / domainSpan) * 100;
                    const width = ((segment.end - segment.start) / domainSpan) * 100;
                    return (
                      <div
                        key={`attendance-${day.workDate}-${segment.id}`}
                        title={`حضور: ${segment.label}`}
                        className='absolute top-2 h-9 rounded-full border border-blue-500 bg-blue-200/80 dark:bg-blue-700/60'
                        style={{ left: `${left}%`, width: `${Math.max(width, 0.8)}%` }}
                      />
                    );
                  })}

                  {day.taskRanges.map((segment) => {
                    const left = ((segment.start - domainMin) / domainSpan) * 100;
                    const width = ((segment.end - segment.start) / domainSpan) * 100;
                    return (
                      <div
                        key={`task-${day.workDate}-${segment.id}`}
                        className='absolute top-[18px] h-5 rounded-full border border-pink-500 bg-pink-200/90 shadow-sm dark:bg-pink-700/70'
                        style={{ left: `${left}%`, width: `${Math.max(width, 0.8)}%` }}
                        onMouseMove={(evt) => {
                          setHoverTask({
                            x: evt.clientX,
                            y: evt.clientY,
                            workDate: day.workDate,
                            taskName: segment.title,
                            duration: segment.duration,
                            label: segment.label,
                          });
                        }}
                        onMouseLeave={() => setHoverTask(null)}
                      />
                    );
                  })}
                </div>
                <div className='flex items-center justify-end border-r border-zinc-200 px-3 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300'>
                  {day.workDate}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {hoverTask && (
        <div
          className='fixed z-50 w-64 rounded-lg border border-zinc-300 bg-white p-3 text-xs shadow-xl dark:border-zinc-600 dark:bg-zinc-900'
          style={{ left: hoverTask.x + 12, top: hoverTask.y + 12 }}
        >
          <div className='mb-1 font-bold text-zinc-900 dark:text-zinc-100'>جزئیات تسک</div>
          <div className='text-zinc-700 dark:text-zinc-300'>تاریخ: {hoverTask.workDate}</div>
          <div className='text-zinc-700 dark:text-zinc-300'>نام تسک: {hoverTask.taskName}</div>
          <div className='text-zinc-700 dark:text-zinc-300'>بازه زمانی: {hoverTask.label}</div>
          <div className='text-zinc-700 dark:text-zinc-300'>مدت زمان: {hoverTask.duration} دقیقه</div>
        </div>
      )}
    </div>
  );
}

