import { useEffect, useMemo, useState } from "react";
import { Edit3, Loader2, Plus, Search, Trash2, UserCheck, Users, X } from "lucide-react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import AppShell from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

type ManagedUser = {
  id: number;
  username: string;
  display_name: string;
  email: string;
  category: string;
  department: string;
  job_title: string;
  extension: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login: string | null;
};

type UserForm = {
  username: string;
  password: string;
  display_name: string;
  email: string;
  category: string;
  department: string;
  job_title: string;
  extension: string;
  is_active: boolean;
  must_change_password: boolean;
};

const emptyForm: UserForm = {
  username: "",
  password: "",
  display_name: "",
  email: "",
  category: "",
  department: "",
  job_title: "",
  extension: "",
  is_active: true,
  must_change_password: true,
};

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "هرگز";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ManagedUser | null | undefined>(undefined);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.get<ManagedUser[]>(endpoints.adminUsers);
      setUsers(data);
    } catch {
      setError("دریافت فهرست کاربران با مشکل مواجه شد.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fa");
    if (!query) return users;
    return users.filter((user) =>
      [user.username, user.display_name, user.email, user.department, user.job_title]
        .join(" ")
        .toLocaleLowerCase("fa")
        .includes(query)
    );
  }, [users, search]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
    setError("");
  };
  const openEdit = (user: ManagedUser) => {
    setForm({
      username: user.username,
      password: "",
      display_name: user.display_name,
      email: user.email,
      category: user.category,
      department: user.department,
      job_title: user.job_title,
      extension: user.extension,
      is_active: user.is_active,
      must_change_password: user.must_change_password,
    });
    setEditing(user);
    setError("");
  };
  const update = (field: keyof UserForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [field]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const payload: Partial<UserForm> = { ...form };
        if (!payload.password) delete payload.password;
        await client.put(`${endpoints.adminUsers}/${editing.id}`, payload);
      } else {
        await client.post(endpoints.adminUsers, form);
      }
      setEditing(undefined);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || "ذخیره اطلاعات کاربر انجام نشد.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (user: ManagedUser) => {
    if (!window.confirm(`دسترسی کاربر «${user.display_name || user.username}» حذف شود؟ سوابق درخواست‌های او حفظ خواهد شد.`)) return;
    try {
      await client.delete(`${endpoints.adminUsers}/${user.id}`);
      await load();
    } catch {
      setError("حذف دسترسی کاربر انجام نشد.");
    }
  };

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Users size={25} /></div>
          <div><h2 className="text-3xl font-extrabold text-slate-900">مدیریت کاربران</h2><p className="mt-1 text-sm text-slate-500">ایجاد، ویرایش، جستجو و کنترل دسترسی کاربران</p></div>
        </div>
        <Button onClick={openCreate} className="h-11 gap-2 rounded-xl bg-red-600 px-5 hover:bg-red-700"><Plus size={18} />کاربر جدید</Button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">همه کاربران</p><p className="mt-1 text-3xl font-extrabold text-slate-900">{users.length.toLocaleString("fa-IR")}</p></section>
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5"><p className="text-sm text-emerald-700">کاربران فعال</p><p className="mt-1 text-3xl font-extrabold text-emerald-900">{users.filter((item) => item.is_active).length.toLocaleString("fa-IR")}</p></section>
        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5"><p className="text-sm text-amber-700">در انتظار تغییر رمز</p><p className="mt-1 text-3xl font-extrabold text-amber-900">{users.filter((item) => item.must_change_password).length.toLocaleString("fa-IR")}</p></section>
      </div>

      {error && editing === undefined && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="relative max-w-lg"><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو بر اساس نام، نام کاربری، ایمیل یا واحد..." className="h-11 rounded-xl pr-10" /></div>
        </div>
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-slate-500"><Loader2 className="animate-spin text-red-600" />در حال دریافت کاربران...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-4 text-right">کاربر</th><th className="px-5 py-4 text-right">واحد و سمت</th><th className="px-5 py-4 text-right">آخرین ورود</th><th className="px-5 py-4 text-right">وضعیت</th><th className="px-5 py-4 text-left">عملیات</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-600">{(user.display_name || user.username).slice(0, 1)}</div><div><p className="font-bold text-slate-800">{user.display_name || "بدون نام"}</p><p className="mt-1 text-xs text-slate-500" dir="ltr">{user.username}{user.email ? ` · ${user.email}` : ""}</p></div></div></td>
                    <td className="px-5 py-4"><p className="text-slate-700">{user.department || "—"}</p><p className="mt-1 text-xs text-slate-400">{user.job_title || user.category || "—"}</p></td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{formatDate(user.last_login)}</td>
                    <td className="px-5 py-4">{user.is_active ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><UserCheck className="ml-1" size={13} />فعال</Badge> : <Badge variant="outline" className="text-slate-500">غیرفعال</Badge>}</td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2"><Button variant="outline" size="icon" onClick={() => openEdit(user)} className="h-9 w-9 rounded-xl text-blue-600" aria-label="ویرایش"><Edit3 size={15} /></Button><Button variant="outline" size="icon" onClick={() => void remove(user)} className="h-9 w-9 rounded-xl border-red-200 text-red-600" aria-label="حذف"><Trash2 size={15} /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <p className="p-12 text-center text-slate-400">کاربری با این مشخصات پیدا نشد.</p>}
          </div>
        )}
      </section>

      {editing !== undefined && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={() => setEditing(undefined)}>
          <form onSubmit={save} onMouseDown={(event) => event.stopPropagation()} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 p-6 backdrop-blur"><div><h3 className="text-xl font-extrabold text-slate-900">{editing ? "ویرایش کاربر" : "ایجاد کاربر جدید"}</h3><p className="mt-1 text-xs text-slate-500">اطلاعات حساب و دسترسی را تکمیل کنید.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setEditing(undefined)} className="rounded-xl"><X size={20} /></Button></div>
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</div>}
              <label className="text-sm font-semibold text-slate-700">نام و نام خانوادگی<Input value={form.display_name} onChange={(e) => update("display_name", e.target.value)} className="mt-2 h-11 rounded-xl" /></label>
              <label className="text-sm font-semibold text-slate-700">نام کاربری<Input value={form.username} onChange={(e) => update("username", e.target.value)} required dir="ltr" className="mt-2 h-11 rounded-xl text-left" /></label>
              <label className="text-sm font-semibold text-slate-700">{editing ? "رمز عبور جدید (اختیاری)" : "رمز عبور"}<Input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required={!editing} minLength={8} dir="ltr" className="mt-2 h-11 rounded-xl text-left" /></label>
              <label className="text-sm font-semibold text-slate-700">ایمیل<Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} dir="ltr" className="mt-2 h-11 rounded-xl text-left" /></label>
              <label className="text-sm font-semibold text-slate-700">واحد سازمانی<Input value={form.department} onChange={(e) => update("department", e.target.value)} className="mt-2 h-11 rounded-xl" /></label>
              <label className="text-sm font-semibold text-slate-700">سمت شغلی<Input value={form.job_title} onChange={(e) => update("job_title", e.target.value)} className="mt-2 h-11 rounded-xl" /></label>
              <label className="text-sm font-semibold text-slate-700">دسته‌بندی<Input value={form.category} onChange={(e) => update("category", e.target.value)} className="mt-2 h-11 rounded-xl" /></label>
              <label className="text-sm font-semibold text-slate-700">شماره داخلی<Input value={form.extension} onChange={(e) => update("extension", e.target.value)} dir="ltr" className="mt-2 h-11 rounded-xl text-left" /></label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} className="h-4 w-4 accent-red-600" />حساب فعال باشد</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.must_change_password} onChange={(e) => update("must_change_password", e.target.checked)} className="h-4 w-4 accent-red-600" />تغییر رمز در ورود بعدی</label>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white/95 p-5 backdrop-blur"><Button type="button" variant="outline" onClick={() => setEditing(undefined)} className="rounded-xl px-5">انصراف</Button><Button disabled={saving} className="gap-2 rounded-xl bg-red-600 px-6 hover:bg-red-700">{saving && <Loader2 className="animate-spin" size={16} />}ذخیره</Button></div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
