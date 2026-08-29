import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Inbox,
  Loader2,
  MailCheck,
  RefreshCw,
  Send,
} from "lucide-react";

import AppShell from "../components/layout/AppShell";
import {
  fetchUserDashboard,
  type DashboardChartItem,
  type UserDashboardData,
} from "../features/userDashboard";

const colors = ["#dc2626", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2"];
const number = (value: number) => value.toLocaleString("fa-IR");

function EmptyState() {
  return <div className="grid min-h-44 place-items-center text-sm text-muted-foreground">هنوز داده‌ای ثبت نشده است.</div>;
}

function DonutChart({ items }: { items: DashboardChartItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const gradient = useMemo(() => {
    if (!total) return "conic-gradient(#e2e8f0 0 100%)";
    let cursor = 0;
    const stops = items.map((item, index) => {
      const start = cursor;
      cursor += (item.value / total) * 100;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${stops.join(",")})`;
  }, [items, total]);

  if (!total) return <EmptyState />;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <div className="relative h-44 w-44 shrink-0 rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-8 grid place-items-center rounded-full bg-card shadow-inner dark:bg-slate-800">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-foreground dark:text-white">{number(total)}</p>
            <p className="text-xs text-muted-foreground">مجموع</p>
          </div>
        </div>
      </div>
      <div className="w-full max-w-xs space-y-2.5">
        {items.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground dark:text-slate-300">
              <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="truncate">{item.label}</span>
            </span>
            <b className="text-foreground dark:text-slate-100">{number(item.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarList({ items }: { items: DashboardChartItem[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  if (!items.length) return <EmptyState />;
  return (
    <div className="space-y-4 py-2">
      {items.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-muted-foreground dark:text-slate-300">{item.label}</span>
            <b className="shrink-0 text-foreground dark:text-slate-100">{number(item.value)}</b>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted dark:bg-slate-700">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((item.value / max) * 100, 4)}%`, backgroundColor: colors[index % colors.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ tasks, requests }: { tasks: DashboardChartItem[]; requests: DashboardChartItem[] }) {
  const labels = Array.from(new Set([...tasks.map((item) => item.label), ...requests.map((item) => item.label)])).sort().slice(-6);
  const taskMap = new Map(tasks.map((item) => [item.label, item.value]));
  const requestMap = new Map(requests.map((item) => [item.label, item.value]));
  const max = Math.max(...labels.flatMap((label) => [taskMap.get(label) || 0, requestMap.get(label) || 0]), 1);
  if (!labels.length) return <EmptyState />;
  return (
    <div>
      <div className="flex h-56 items-end gap-3 border-b border-border pt-6 dark:border-slate-700">
        {labels.map((label) => (
          <div key={label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex flex-1 items-end justify-center gap-1.5">
              <div title={`وظایف: ${number(taskMap.get(label) || 0)}`} className="w-4 rounded-t-md bg-primary sm:w-6" style={{ height: `${Math.max(((taskMap.get(label) || 0) / max) * 100, 2)}%` }} />
              <div title={`درخواست‌ها: ${number(requestMap.get(label) || 0)}`} className="w-4 rounded-t-md bg-blue-500 sm:w-6" style={{ height: `${Math.max(((requestMap.get(label) || 0) / max) * 100, 2)}%` }} />
            </div>
            <span className="mt-2 truncate text-center text-[10px] text-muted-foreground sm:text-xs" dir="ltr">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-6 text-xs font-bold text-muted-foreground">
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-primary" />وظایف من</span>
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-blue-500" />درخواست‌های من</span>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
      <h3 className="font-extrabold text-foreground dark:text-white">{title}</h3>
      {subtitle && <p className="mb-5 mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      {!subtitle && <div className="h-5" />}
      {children}
    </section>
  );
}

export default function UserDashboardPage() {
  const [data, setData] = useState<UserDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchUserDashboard());
    } catch {
      setError("دریافت اطلاعات داشبورد با مشکل مواجه شد.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading && !data) {
    return <AppShell><div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="animate-spin text-primary" />در حال آماده‌سازی داشبورد شما...</div></AppShell>;
  }

  const summary = data?.summary;
  const cards = summary ? [
    ["کل وظایف", summary.total_tasks, `${number(summary.open_tasks)} وظیفه باز`, Inbox, "bg-primary/10 text-primary"],
    ["وظایف انجام‌شده", summary.completed_tasks, "در وضعیت انجام‌شده", CheckCircle2, "bg-emerald-50 text-emerald-600"],
    ["نامه‌های دریافتی", summary.received_letters, "نامه‌های خطاب به شما", ArrowDownToLine, "bg-cyan-50 text-cyan-600"],
    ["درخواست‌های من", summary.total_requests, `${number(summary.open_requests)} درخواست باز`, ClipboardList, "bg-blue-50 text-blue-600"],
    ["درخواست‌های انجام‌شده", summary.completed_requests, "در وضعیت انجام‌شده", MailCheck, "bg-violet-50 text-violet-600"],
    ["نامه‌های ارسالی", summary.sent_letters, "تعداد نامه‌های یکتا", Send, "bg-amber-50 text-amber-600"],
  ] as const : [];

  return (
    <AppShell>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><BarChart3 size={25} /></div>
          <div>
            <h2 className="text-2xl font-extrabold text-foreground dark:text-white sm:text-3xl">داشبورد من</h2>
            <p className="mt-1 text-sm text-muted-foreground">نمای کلی وظایف، درخواست‌ها و نامه‌های {data?.user_name}</p>
          </div>
        </div>
        <Button variant="ghost" type="button" onClick={() => void load()} disabled={loading} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-muted-foreground transition hover:border-primary/30 hover:text-primary disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />به‌روزرسانی
        </Button>
      </div>

      {error && <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary">{error}</div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, detail, Icon, color]) => (
          <section key={label} className="rounded-3xl border border-border bg-card p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className={`mb-4 grid h-11 w-11 place-items-center rounded-2xl ${color}`}><Icon size={21} /></div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-extrabold text-foreground dark:text-white">{number(value)}</p>
            <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
          </section>
        ))}
      </div>

      {data?.summary && <>
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel title="وضعیت وظایف من" subtitle="همه وظایفی که برای شما قابل مشاهده یا اقدام است"><DonutChart items={data.task_statuses} /></Panel>
          <Panel title="وضعیت درخواست‌های من" subtitle="همه درخواست‌هایی که شما ثبت کرده‌اید"><DonutChart items={data.request_statuses} /></Panel>
        </div>
        <div className="mb-6"><Panel title="روند شش‌ماهه" subtitle="مقایسه تعداد وظایف دریافتی و درخواست‌های ثبت‌شده"><TrendChart tasks={data.monthly_tasks} requests={data.monthly_requests} /></Panel></div>
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel title="بیشترین درخواست‌کنندگان از شما" subtitle="افرادی که بیشترین وظیفه را برای شما ایجاد کرده‌اند"><BarList items={data.top_requesters} /></Panel>
          <Panel title="بیشترین گیرندگان درخواست‌های شما" subtitle="افرادی که درخواست‌های شما بیشتر به آن‌ها ارجاع اولیه شده است"><BarList items={data.top_recipients} /></Panel>
          <Panel title="واحدهای درخواست‌کننده از شما" subtitle="واحد سازمانی ثبت‌کنندگان وظایف شما"><BarList items={data.requester_departments} /></Panel>
          <Panel title="مقصد درخواست‌های من" subtitle="واحدهای پرتال مقصد درخواست‌های ثبت‌شده"><BarList items={data.request_departments} /></Panel>
          <Panel title="نوع درخواست‌های من" subtitle="فرم‌های پرکاربرد شما"><BarList items={data.request_forms} /></Panel>
          <Panel title="نامه‌های ارسالی و دریافتی" subtitle="تفکیک نامه‌های درون‌سازمانی و برون‌سازمانی">
            <div className="grid gap-5 sm:grid-cols-2">
              <div><p className="mb-3 flex items-center gap-2 text-sm font-bold text-muted-foreground dark:text-slate-300"><ArrowUpFromLine size={16} className="text-amber-600" />ارسالی</p><BarList items={data.letters.sent_by_type} /></div>
              <div><p className="mb-3 flex items-center gap-2 text-sm font-bold text-muted-foreground dark:text-slate-300"><ArrowDownToLine size={16} className="text-cyan-600" />دریافتی</p><BarList items={data.letters.received_by_type} /></div>
            </div>
          </Panel>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="وضعیت گیرندگان نامه‌های ارسالی" subtitle="وضعیت هر نسخه ارسالی به گیرندگان"><DonutChart items={data.letters.sent_by_status} /></Panel>
          <Panel title="وضعیت نامه‌های دریافتی" subtitle="وضعیت نامه‌هایی که مستقیماً خطاب به شماست"><DonutChart items={data.letters.received_by_status} /></Panel>
        </div>
      </>}
    </AppShell>
  );
}
