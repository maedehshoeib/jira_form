import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarClock,
  FileText,
  Loader2,
  MonitorSmartphone,
  Users,
} from "lucide-react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import AppShell from "../../components/layout/AppShell";

type ChartItem = { label: string; value: number };
type DashboardData = {
  total_users: number;
  active_users: number;
  total_requests: number;
  requests_today: number;
  active_admin_devices: number;
  requests_by_status: ChartItem[];
  requests_by_department: ChartItem[];
  requests_by_month: ChartItem[];
  recent_requests: {
    id: number;
    subject: string;
    status: string;
    form_id: string;
    submitted_by: string;
    created_at: string;
  }[];
};

const number = (value: number) => value.toLocaleString("fa-IR");
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function HorizontalChart({
  items,
  color = "bg-red-500",
}: {
  items: ChartItem[];
  color?: string;
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
            <span className="font-bold text-slate-800">{number(item.value)}</span>
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

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get<DashboardData>(endpoints.adminDashboard)
      .then((response) => setData(response.data))
      .catch(() => setError("دریافت اطلاعات داشبورد با مشکل مواجه شد."));
  }, []);

  const peak = useMemo(
    () => Math.max(...(data?.requests_by_month.map((item) => item.value) || [1]), 1),
    [data]
  );

  if (!data && !error) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="animate-spin text-red-600" />
          در حال آماده‌سازی داشبورد...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <BarChart3 size={25} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900">داشبورد مدیریت</h2>
            <p className="mt-1 text-sm text-slate-500">نمای کلی کاربران، درخواست‌ها و وضعیت سامانه</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "کل کاربران", value: data.total_users, detail: `${number(data.active_users)} کاربر فعال`, icon: Users, color: "bg-blue-50 text-blue-600" },
              { label: "کل درخواست‌ها", value: data.total_requests, detail: "از ابتدای فعالیت", icon: FileText, color: "bg-red-50 text-red-600" },
              { label: "درخواست‌های امروز", value: data.requests_today, detail: "ثبت‌شده امروز", icon: CalendarClock, color: "bg-amber-50 text-amber-600" },
              { label: "نرخ فعالیت کاربران", value: data.total_users ? Math.round((data.active_users / data.total_users) * 100) : 0, suffix: "٪", detail: "کاربران دارای دسترسی", icon: Activity, color: "bg-emerald-50 text-emerald-600" },
              { label: "دستگاه‌های مدیر", value: data.active_admin_devices, detail: "حداکثر ۴ دستگاه", icon: MonitorSmartphone, color: "bg-violet-50 text-violet-600" },
            ].map(({ label, value, suffix, detail, icon: Icon, color }) => (
              <section key={label} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${color}`}><Icon size={21} /></div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-3xl font-extrabold text-slate-900">{number(value)}{suffix}</p>
                <p className="mt-2 text-xs text-slate-400">{detail}</p>
              </section>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
              <h3 className="mb-6 font-bold text-slate-800">روند درخواست‌ها در ۶ ماه گذشته</h3>
              <div className="flex h-64 items-end gap-3 border-b border-slate-100 px-2 pt-6">
                {data.requests_by_month.map((item) => (
                  <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-xs font-bold text-slate-600">{number(item.value)}</span>
                    <div
                      className="w-full max-w-16 rounded-t-xl bg-gradient-to-t from-red-600 to-red-400 transition-all"
                      style={{ height: `${Math.max((item.value / peak) * 78, item.value ? 8 : 2)}%` }}
                      title={`${item.label}: ${item.value}`}
                    />
                    <span className="whitespace-nowrap text-[11px] text-slate-400" dir="ltr">{item.label}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="mb-6 font-bold text-slate-800">درخواست‌ها بر اساس وضعیت</h3>
              <HorizontalChart items={data.requests_by_status} color="bg-emerald-500" />
            </section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-5">
            <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
              <h3 className="mb-6 font-bold text-slate-800">واحدهای پرتکرار</h3>
              <HorizontalChart items={data.requests_by_department} />
            </section>
            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm xl:col-span-3">
              <div className="border-b border-slate-100 p-6">
                <h3 className="font-bold text-slate-800">آخرین درخواست‌ها</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-3 text-right">درخواست</th><th className="px-5 py-3 text-right">کاربر</th><th className="px-5 py-3 text-right">زمان</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recent_requests.map((request) => (
                      <tr key={request.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4"><p className="max-w-xs truncate font-semibold text-slate-700">{request.subject || request.form_id}</p><p className="mt-1 text-xs text-slate-400">شناسه #{number(request.id)}</p></td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">{request.submitted_by}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{dateTime(request.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.recent_requests.length && <p className="p-10 text-center text-sm text-slate-400">درخواستی وجود ندارد.</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}
