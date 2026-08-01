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

type TimeRange = {
  id: string;
  start: number;
  end: number;
};

type TaskRange = TimeRange & {
  title: string;
  duration: number;
  label: string;
  lane: number;
};

type HoverTask = {
  x: number;
  y: number;
  workDate: string;
  taskName: string;
  duration: number;
  label: string;
};

const COPY = {
  empty: '\u0628\u0631\u0627\u06cc \u0646\u0645\u0627\u06cc\u0634 \u062a\u0627\u06cc\u0645\u200c\u0644\u0627\u06cc\u0646 \u0627\u0628\u062a\u062f\u0627 \u062d\u0636\u0648\u0631 \u06cc\u0627 \u0641\u0639\u0627\u0644\u06cc\u062a \u062b\u0628\u062a \u06a9\u0646\u06cc\u062f.',
  attendance: '\u0628\u0627\u0632\u0647 \u062d\u0636\u0648\u0631',
  task: '\u0641\u0639\u0627\u0644\u06cc\u062a',
  now: '\u0627\u06a9\u0646\u0648\u0646',
  noRecords: '\u0628\u062f\u0648\u0646 \u062b\u0628\u062a \u062d\u0636\u0648\u0631 \u06cc\u0627 \u0641\u0639\u0627\u0644\u06cc\u062a',
  tasks: '\u0641\u0639\u0627\u0644\u06cc\u062a',
  details: '\u062c\u0632\u0626\u06cc\u0627\u062a \u0641\u0639\u0627\u0644\u06cc\u062a',
  date: '\u062a\u0627\u0631\u06cc\u062e',
  time: '\u0628\u0627\u0632\u0647 \u0632\u0645\u0627\u0646\u06cc',
  duration: '\u0645\u062f\u062a',
  minute: '\u062f\u0642\u06cc\u0642\u0647',
};

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function formatMinutesToTime(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function clampMinute(value: number): number {
  return Math.max(0, Math.min(24 * 60, value));
}

function mergeAttendanceRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort(
    (first, second) => first.start - second.start || first.end - second.end,
  );

  return sorted.reduce<TimeRange[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
      previous.id = `${previous.id}-${range.id}`;
    } else {
      merged.push({ ...range });
    }
    return merged;
  }, []);
}

function assignTaskLanes(
  ranges: Omit<TaskRange, 'lane'>[],
): { ranges: TaskRange[]; laneCount: number } {
  const laneEnds: number[] = [];
  const sorted = [...ranges].sort(
    (first, second) => first.start - second.start || first.end - second.end,
  );
  const result = sorted.map((range) => {
    let lane = laneEnds.findIndex((end) => end <= range.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(range.end);
    } else {
      laneEnds[lane] = range.end;
    }
    return { ...range, lane };
  });

  return { ranges: result, laneCount: laneEnds.length };
}

export function TasksGanttChart({ days }: GanttProps): JSX.Element {
  const [hoverTask, setHoverTask] = React.useState<HoverTask | null>(null);

  if (!days.length) {
    return (
      <div className='p-8 text-center text-sm text-slate-500'>{COPY.empty}</div>
    );
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dayRows = days.map((day) => {
    const attendanceRanges = mergeAttendanceRanges(
      day.attendance
        .filter((item) => Boolean(item.check_in_time))
        .map((item) => {
          const start = clampMinute(parseTimeToMinutes(item.check_in_time));
          const end = clampMinute(
            item.check_out_time
              ? parseTimeToMinutes(item.check_out_time)
              : nowMinutes,
          );
          return {
            id: String(item.id),
            start: Math.min(start, end),
            end: Math.max(start, end),
          };
        }),
    );
    const tasksWithLanes = assignTaskLanes(
      day.tasks.map((item) => {
        const start = clampMinute(parseTimeToMinutes(item.start_time));
        const end = clampMinute(parseTimeToMinutes(item.end_time));
        return {
          id: String(item.id),
          title: item.task_name,
          start: Math.min(start, end),
          end: Math.max(start, end),
          duration: Math.max(item.minutes_spent, Math.abs(end - start)),
          label: `${item.start_time} - ${item.end_time}`,
        };
      }),
    );

    return {
      workDate: day.work_date,
      attendanceRanges,
      taskRanges: tasksWithLanes.ranges,
      laneCount: tasksWithLanes.laneCount,
    };
  });

  const allRanges = dayRows.flatMap((day) => [
    ...day.attendanceRanges,
    ...day.taskRanges,
  ]);
  const minStart = allRanges.length
    ? Math.min(...allRanges.map((range) => range.start))
    : 8 * 60;
  const maxEnd = allRanges.length
    ? Math.max(...allRanges.map((range) => range.end))
    : 17 * 60;
  const domainMin = clampMinute(Math.floor((minStart - 30) / 60) * 60);
  const domainMax = clampMinute(Math.ceil((maxEnd + 30) / 60) * 60);
  const domainSpan = Math.max(60, domainMax - domainMin);
  const tickStep = domainSpan > 12 * 60 ? 120 : 60;
  const ticks: number[] = [];
  for (let minute = domainMin; minute <= domainMax; minute += tickStep) {
    ticks.push(minute);
  }
  if (ticks[ticks.length - 1] !== domainMax) ticks.push(domainMax);

  const position = (minute: number) =>
    ((minute - domainMin) / domainSpan) * 100;

  return (
    <div className='overflow-hidden rounded-2xl border border-slate-200 bg-white' dir='ltr'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3' dir='rtl'>
        <div className='flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600'>
          <span className='flex items-center gap-2'>
            <span className='h-3 w-7 rounded border border-sky-400 bg-sky-100' />
            {COPY.attendance}
          </span>
          <span className='flex items-center gap-2'>
            <span className='h-3 w-7 rounded bg-indigo-500' />
            {COPY.task}
          </span>
        </div>
        <span className='text-[11px] text-slate-400'>
          {formatMinutesToTime(domainMin)} — {formatMinutesToTime(domainMax)}
        </span>
      </div>

      <div className='overflow-x-auto'>
        <div className='min-w-[920px]'>
          <div className='grid grid-cols-[minmax(0,1fr)_140px] border-b border-slate-200 bg-white'>
            <div className='relative h-10'>
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className='absolute top-3 -translate-x-1/2 font-mono text-[11px] font-semibold text-slate-500'
                  style={{ left: `${position(tick)}%` }}
                >
                  {formatMinutesToTime(tick)}
                </span>
              ))}
            </div>
            <div className='border-l border-slate-200' />
          </div>

          {dayRows.map((day, rowIndex) => {
            const rowHeight = Math.max(76, 48 + Math.max(1, day.laneCount) * 30);
            const hasRecords =
              day.attendanceRanges.length > 0 || day.taskRanges.length > 0;

            return (
              <div
                key={day.workDate}
                className={`grid grid-cols-[minmax(0,1fr)_140px] border-b border-slate-100 last:border-b-0 ${
                  rowIndex % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'
                }`}
              >
                <div className='relative' style={{ height: rowHeight }}>
                  {ticks.map((tick) => (
                    <span
                      key={`${day.workDate}-${tick}`}
                      className='pointer-events-none absolute inset-y-0 border-l border-dashed border-slate-200'
                      style={{ left: `${position(tick)}%` }}
                    />
                  ))}

                  {!hasRecords && (
                    <div className='absolute inset-0 flex items-center justify-center text-xs text-slate-400' dir='rtl'>
                      {COPY.noRecords}
                    </div>
                  )}

                  {day.attendanceRanges.map((segment) => {
                    const width = position(segment.end) - position(segment.start);
                    return (
                      <div
                        key={`attendance-${day.workDate}-${segment.id}`}
                        className='absolute top-2 flex h-6 items-center overflow-hidden rounded-md border border-sky-400 bg-sky-100 px-2 text-[10px] font-bold text-sky-800'
                        style={{
                          left: `${position(segment.start)}%`,
                          width: `${Math.max(width, 0.7)}%`,
                        }}
                        title={`${COPY.attendance}: ${formatMinutesToTime(segment.start)} - ${formatMinutesToTime(segment.end)}`}
                      >
                        {width >= 9 && (
                          <span className='truncate' dir='ltr'>
                            {formatMinutesToTime(segment.start)} - {formatMinutesToTime(segment.end)}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {day.taskRanges.map((segment) => {
                    const width = position(segment.end) - position(segment.start);
                    return (
                      <button
                        type='button'
                        key={`task-${day.workDate}-${segment.id}`}
                        className='absolute flex h-6 items-center overflow-hidden rounded-md bg-indigo-500 px-2 text-left text-[10px] font-bold text-white shadow-sm outline-none transition hover:z-10 hover:bg-indigo-600 focus:z-10 focus:ring-2 focus:ring-indigo-300'
                        style={{
                          left: `${position(segment.start)}%`,
                          top: 40 + segment.lane * 30,
                          width: `${Math.max(width, 0.7)}%`,
                        }}
                        aria-label={`${segment.title}, ${segment.label}`}
                        onMouseEnter={(event) => {
                          const tooltipWidth = 288;
                          setHoverTask({
                            x: Math.min(event.clientX + 12, window.innerWidth - tooltipWidth - 12),
                            y: Math.min(event.clientY + 12, window.innerHeight - 150),
                            workDate: day.workDate,
                            taskName: segment.title,
                            duration: segment.duration,
                            label: segment.label,
                          });
                        }}
                        onMouseMove={(event) =>
                          setHoverTask((current) =>
                            current
                              ? {
                                  ...current,
                                  x: Math.min(event.clientX + 12, window.innerWidth - 300),
                                  y: Math.min(event.clientY + 12, window.innerHeight - 150),
                                }
                              : null,
                          )
                        }
                        onMouseLeave={() => setHoverTask(null)}
                        onBlur={() => setHoverTask(null)}
                      >
                        {width >= 6 && <span className='truncate'>{segment.title}</span>}
                      </button>
                    );
                  })}
                </div>

                <div className='flex flex-col items-end justify-center border-l border-slate-200 px-4 text-right' dir='rtl'>
                  <span className='font-mono text-xs font-extrabold text-slate-800'>
                    {day.workDate}
                  </span>
                  <span className='mt-1 text-[10px] text-slate-400'>
                    {day.taskRanges.length} {COPY.tasks}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hoverTask && (
        <div
          className='pointer-events-none fixed z-50 w-72 rounded-xl border border-slate-200 bg-slate-950 p-3 text-xs text-white shadow-2xl'
          style={{ left: hoverTask.x, top: hoverTask.y }}
          dir='rtl'
        >
          <div className='mb-2 truncate font-extrabold'>{hoverTask.taskName}</div>
          <div className='grid grid-cols-[64px_1fr] gap-x-2 gap-y-1 text-slate-300'>
            <span>{COPY.date}</span><span className='text-white'>{hoverTask.workDate}</span>
            <span>{COPY.time}</span><span className='font-mono text-white' dir='ltr'>{hoverTask.label}</span>
            <span>{COPY.duration}</span><span className='text-white'>{hoverTask.duration} {COPY.minute}</span>
          </div>
        </div>
      )}
    </div>
  );
}
