import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlarmClock, BellRing, CheckCircle2, Loader2 } from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import notificationBell from "@/assets/home-icons/notification-bell.jpg";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type TaskInboxNotification = {
  id: string;
  kind: "reminder" | "deadline" | "completed" | string;
  submission_id: number;
  subject: string;
  message: string;
  created_at: string;
};

type TaskInboxNotificationResponse = {
  count: number;
  items: TaskInboxNotification[];
};

const KIND_META: Record<
  string,
  { label: string; icon: typeof BellRing; className: string }
> = {
  reminder: {
    label: "یادآوری",
    icon: BellRing,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  },
  deadline: {
    label: "مهلت",
    icon: AlarmClock,
    className: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200",
  },
  completed: {
    label: "انجام‌شده",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
  },
};

export default function HomeNotifications() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TaskInboxNotification[]>([]);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { data } = await client.get<TaskInboxNotificationResponse>(
        endpoints.taskNotifications,
      );
      setItems(data.items);
      setCount(data.count);
    } catch {
      // Keep the home page usable if notifications are temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    const onRefresh = () => void refresh();
    window.addEventListener("tasks:refresh-notifications", onRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("tasks:refresh-notifications", onRefresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, [open, refresh]);

  const openTask = (submissionId: number) => {
    setOpen(false);
    router.push(`/my-tasks?open=${submissionId}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={
            count > 0
              ? `اعلان‌ها، ${count.toLocaleString("fa-IR")} مورد خوانده‌نشده`
              : "اعلان‌ها"
          }
          className="relative h-14 w-14 rounded-2xl border border-border/80 bg-card/90 p-1.5 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)] hover:bg-card dark:border-white/15 dark:bg-slate-900/80"
        >
          <Image
            src={notificationBell}
            alt=""
            width={48}
            height={48}
            className="h-full w-full rounded-xl object-cover"
            aria-hidden="true"
          />
          {count > 0 && (
            <span className="absolute -left-1 -top-1 min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-destructive-foreground shadow-sm">
              {count > 99 ? "+۹۹" : count.toLocaleString("fa-IR")}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-border p-0 shadow-xl"
      >
        <div className="border-b border-border bg-muted/40 px-4 py-3">
          <p className="text-sm font-bold text-foreground">اعلان‌های وظایف</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            یادآوری‌ها، مهلت‌ها و وظایف انجام‌شده
          </p>
        </div>
        <div className="max-h-[min(28rem,60vh)] overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال دریافت اعلان‌ها…
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              اعلان خوانده‌نشده‌ای ندارید.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const meta = KIND_META[item.kind] ?? KIND_META.reminder;
                const Icon = meta.icon;
                return (
                  <li key={item.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => openTask(item.submission_id)}
                      className="h-auto w-full items-start justify-start gap-3 rounded-none px-4 py-3.5 text-right whitespace-normal hover:bg-muted/70"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                          meta.className,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-muted-foreground">
                            {meta.label}
                          </span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {item.created_at}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm font-bold leading-6 text-foreground">
                          {item.subject}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                          {item.message}
                        </span>
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
