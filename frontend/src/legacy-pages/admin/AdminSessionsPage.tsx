import { Table } from "@/components/ui/table";
import { useEffect, useState } from "react";
import { History, Loader2, LogOut, MonitorSmartphone, RefreshCw, ShieldCheck } from "lucide-react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import AppShell from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { formatPersianDateTime } from "../../lib/persianDate";

type AdminSession = {
  id: number;
  device_id: string;
  device_name: string;
  user_agent: string;
  ip_address: string;
  logged_in_at: string;
  last_seen_at: string;
  logged_out_at: string | null;
  is_active: boolean;
};

const formatDate = (value: string | null) =>
  value ? formatPersianDateTime(value) : "—";

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get<AdminSession[]>(endpoints.adminSessions);
      setSessions(data);
    } catch {
      setError("دریافت تاریخچه ورود با مشکل مواجه شد.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const revoke = async (session: AdminSession) => {
    if (!window.confirm(`نشست «${session.device_name}» از حساب خارج شود؟`)) return;
    await client.delete(`${endpoints.adminSessions}/${session.id}`);
    await load();
  };

  const activeCount = new Set(sessions.filter((item) => item.is_active).map((item) => item.device_id)).size;

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><History size={25} /></div>
          <div><h2 className="text-3xl font-extrabold text-foreground">دستگاه‌ها و ورودها</h2><p className="mt-1 text-sm text-muted-foreground">گزارش نشست‌های حساب مدیر و مدیریت دسترسی دستگاه‌ها</p></div>
        </div>
        <Button variant="outline" onClick={() => void load()} className="gap-2 rounded-xl"><RefreshCw size={16} />به‌روزرسانی</Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-3xl border border-violet-100 bg-violet-50 p-5">
          <div className="flex items-center gap-4"><MonitorSmartphone className="text-violet-600" /><div><p className="text-sm text-violet-700">دستگاه‌های فعال</p><p className="mt-1 text-2xl font-extrabold text-violet-950">{activeCount.toLocaleString("fa-IR")} از ۴</p></div></div>
        </section>
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
          <div className="flex items-center gap-4"><ShieldCheck className="text-emerald-600" /><div><p className="text-sm text-emerald-700">کنترل دسترسی</p><p className="mt-1 font-bold text-emerald-950">محدودیت هم‌زمان فعال است</p></div></div>
        </section>
      </div>

      {error && <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-primary">{error}</div>}
      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground"><Loader2 className="animate-spin text-primary" />در حال دریافت گزارش...</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-5 py-4 text-right">دستگاه</th><th className="px-5 py-4 text-right">نشانی IP</th><th className="px-5 py-4 text-right">زمان ورود</th><th className="px-5 py-4 text-right">آخرین فعالیت</th><th className="px-5 py-4 text-right">وضعیت</th><th className="px-5 py-4"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <tr key={session.id} className="align-top hover:bg-muted/40">
                    <td className="px-5 py-4"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><MonitorSmartphone size={18} /></div><div><p className="font-bold text-foreground" dir="ltr">{session.device_name}</p><p className="mt-1 max-w-sm truncate text-xs text-muted-foreground" dir="ltr" title={session.user_agent}>{session.user_agent}</p></div></div></td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground" dir="ltr">{session.ip_address || "—"}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDate(session.logged_in_at)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDate(session.last_seen_at)}</td>
                    <td className="px-5 py-4">{session.is_active ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">فعال</Badge> : <Badge variant="outline" className="text-muted-foreground">خارج‌شده</Badge>}</td>
                    <td className="px-5 py-4">{session.is_active && <Button variant="outline" size="sm" onClick={() => void revoke(session)} className="gap-2 rounded-xl border-primary/30 text-primary"><LogOut size={14} />خروج</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {!sessions.length && <p className="p-12 text-center text-muted-foreground">تاریخچه‌ای ثبت نشده است.</p>}
          </div>
        )}
      </section>
    </AppShell>
  );
}
