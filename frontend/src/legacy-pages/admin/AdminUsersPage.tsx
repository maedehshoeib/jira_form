import { NativeSelect } from "@/components/ui/native-select";
import { Table } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Edit3,
  KeyRound,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import AppShell from "../../components/layout/AppShell";
import UserAvatar from "../../components/UserAvatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatPersianDateTime } from "../../lib/persianDate";
import { formatUserDisplayName } from "../../lib/userDisplay";
import UserDisplayName from "../../components/UserDisplayName";

type ManagedUser = {
  id: number;
  username: string;
  display_name: string;
  email: string;
  category: string;
  department: string;
  department_id: number | null;
  job_title: string;
  extension: string;
  avatar_url: string;
  birth_date?: string | null;
  is_birthday?: boolean;
  is_active: boolean;
  is_admin: boolean;
  is_letter_recipient: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login: string | null;
};

type ManagedDepartment = {
  id: number;
  name: string;
  description: string;
  access_configured: boolean;
  user_count: number;
};

type AccessTarget = {
  portal_department_id: string;
  portal_department_title: string;
  section_id: string;
  section_title: string;
  form_id: string;
};

type UserForm = {
  username: string;
  password: string;
  display_name: string;
  email: string;
  category: string;
  department_id: number | null;
  job_title: string;
  extension: string;
  is_active: boolean;
  is_admin: boolean;
  is_letter_recipient: boolean;
  must_change_password: boolean;
};

type AccessEditor =
  | { kind: "department"; id: number; title: string }
  | { kind: "user"; id: number; title: string };

const emptyForm: UserForm = {
  username: "",
  password: "",
  display_name: "",
  email: "",
  category: "",
  department_id: null,
  job_title: "",
  extension: "",
  is_active: true,
  is_admin: false,
  is_letter_recipient: false,
  must_change_password: true,
};

const targetKey = (target: AccessTarget) =>
  `${target.portal_department_id}:${target.section_id}:${target.form_id}`;

const formatDate = (value: string | null) =>
  value ? formatPersianDateTime(value) : "هرگز";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [departments, setDepartments] = useState<ManagedDepartment[]>([]);
  const [catalog, setCatalog] = useState<AccessTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ManagedUser | null | undefined>();
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentDescription, setDepartmentDescription] = useState("");
  const [editingDepartment, setEditingDepartment] =
    useState<ManagedDepartment | null>(null);
  const departmentFormRef = useRef<HTMLFormElement>(null);
  const [departmentFeedback, setDepartmentFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [accessEditor, setAccessEditor] = useState<AccessEditor | null>(null);
  const [accessConfigured, setAccessConfigured] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [userResponse, departmentResponse, catalogResponse] =
        await Promise.all([
          client.get<ManagedUser[]>(endpoints.adminUsers),
          client.get<ManagedDepartment[]>(endpoints.adminDepartments),
          client.get<AccessTarget[]>(endpoints.adminFormAccessCatalog),
        ]);
      setUsers(userResponse.data);
      setDepartments(departmentResponse.data);
      setCatalog(catalogResponse.data);
      setError("");
    } catch {
      setError("دریافت اطلاعات کاربران و واحدها با مشکل مواجه شد.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fa");
    if (!query) return users;
    return users.filter((user) =>
      [
        user.username,
        user.display_name,
        user.email,
        user.department,
        user.job_title,
        user.category,
      ]
        .join(" ")
        .toLocaleLowerCase("fa")
        .includes(query),
    );
  }, [users, search]);

  const groupedUsers = useMemo(() => {
    const groups = departments.map((department) => ({
      department,
      users: filtered.filter((user) => user.department_id === department.id),
    }));
    const unassigned = filtered.filter(
      (user) =>
        user.department_id === null ||
        !departments.some((department) => department.id === user.department_id),
    );
    return [
      ...groups,
      ...(unassigned.length
        ? [
            {
              department: {
                id: 0,
                name: "بدون واحد سازمانی",
                description: "",
                access_configured: false,
                user_count: unassigned.length,
              },
              users: unassigned,
            },
          ]
        : []),
    ].filter((group) => group.users.length || !search.trim());
  }, [departments, filtered, search]);

  const catalogGroups = useMemo(() => {
    const groups = new Map<string, AccessTarget[]>();
    catalog.forEach((target) => {
      const current = groups.get(target.portal_department_title) || [];
      current.push(target);
      groups.set(target.portal_department_title, current);
    });
    return [...groups.entries()];
  }, [catalog]);

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
      department_id: user.department_id,
      job_title: user.job_title,
      extension: user.extension,
      is_active: user.is_active,
      is_admin: user.is_admin,
      is_letter_recipient: user.is_letter_recipient,
      must_change_password: user.must_change_password,
    });
    setEditing(user);
    setError("");
  };

  const update = (field: keyof UserForm, value: string | boolean | number | null) =>
    setForm((current) => ({ ...current, [field]: value }));

  const saveUser = async (event: React.FormEvent) => {
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
      setError(
        requestError?.response?.data?.detail ||
          "ذخیره اطلاعات کاربر انجام نشد.",
      );
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (user: ManagedUser) => {
    if (
      !window.confirm(
        `دسترسی کاربر «${formatUserDisplayName(user)}» حذف شود؟ سوابق درخواست‌های او حفظ خواهد شد.`,
      )
    )
      return;
    try {
      await client.delete(`${endpoints.adminUsers}/${user.id}`);
      await load();
    } catch {
      setError("حذف دسترسی کاربر انجام نشد.");
    }
  };

  const saveDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!departmentName.trim()) return;
    setSaving(true);
    setDepartmentFeedback(null);
    try {
      const payload = {
        name: departmentName.trim(),
        description: departmentDescription.trim(),
      };
      if (editingDepartment) {
        await client.put(
          `${endpoints.adminDepartments}/${editingDepartment.id}`,
          payload,
        );
      } else {
        await client.post(endpoints.adminDepartments, payload);
      }
      const successText = editingDepartment
        ? "تغییرات واحد سازمانی ذخیره شد."
        : "واحد سازمانی جدید ایجاد شد.";
      setDepartmentName("");
      setDepartmentDescription("");
      setEditingDepartment(null);
      await load();
      setDepartmentFeedback({ type: "success", text: successText });
    } catch (requestError: any) {
      setDepartmentFeedback({
        type: "error",
        text:
          requestError?.response?.data?.detail ||
          "ذخیره واحد سازمانی انجام نشد.",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeDepartment = async (department: ManagedDepartment) => {
    setDepartmentFeedback(null);
    if (department.user_count > 0) {
      setDepartmentFeedback({
        type: "error",
        text: `واحد «${department.name}» دارای ${department.user_count.toLocaleString("fa-IR")} کاربر است. ابتدا کاربران را به واحد دیگری منتقل کنید.`,
      });
      departmentFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    if (!window.confirm(`واحد «${department.name}» حذف شود؟`)) return;
    try {
      await client.delete(`${endpoints.adminDepartments}/${department.id}`);
      await load();
      setDepartmentFeedback({
        type: "success",
        text: `واحد «${department.name}» حذف شد.`,
      });
      departmentFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } catch (requestError: any) {
      setDepartmentFeedback({
        type: "error",
        text:
          requestError?.response?.data?.detail ||
          "حذف واحد سازمانی انجام نشد.",
      });
    }
  };

  const openAccess = async (editor: AccessEditor) => {
    setAccessEditor(editor);
    setAccessLoading(true);
    setAccessError("");
    setAccessConfigured(false);
    setSelectedTargets(new Set());
    setError("");
    try {
      const base =
        editor.kind === "department"
          ? endpoints.adminDepartments
          : endpoints.adminUsers;
      const { data } = await client.get<{
        configured: boolean;
        targets: string[];
      }>(`${base}/${editor.id}/form-access`);
      setAccessConfigured(data.configured);
      setSelectedTargets(new Set(data.targets));
    } catch (requestError: any) {
      setAccessError(
        requestError?.response?.data?.detail ||
          "دریافت دسترسی فرم‌ها انجام نشد. سرویس را دوباره راه‌اندازی و مجدداً تلاش کنید.",
      );
    } finally {
      setAccessLoading(false);
    }
  };

  const saveAccess = async () => {
    if (!accessEditor) return;
    setAccessLoading(true);
    setAccessError("");
    try {
      const base =
        accessEditor.kind === "department"
          ? endpoints.adminDepartments
          : endpoints.adminUsers;
      await client.put(`${base}/${accessEditor.id}/form-access`, {
        configured: accessConfigured,
        targets: [...selectedTargets],
      });
      setAccessEditor(null);
      await load();
      setDepartmentFeedback({
        type: "success",
        text: "دسترسی فرم‌ها با موفقیت ذخیره شد.",
      });
    } catch (requestError: any) {
      setAccessError(
        requestError?.response?.data?.detail || "ذخیره دسترسی فرم‌ها انجام نشد.",
      );
    } finally {
      setAccessLoading(false);
    }
  };

  const toggleTarget = (key: string) =>
    setSelectedTargets((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const beginDepartmentEdit = (department: ManagedDepartment) => {
    setEditingDepartment(department);
    setDepartmentName(department.name);
    setDepartmentDescription(department.description);
    setDepartmentFeedback(null);
    requestAnimationFrame(() => {
      departmentFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      departmentFormRef.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus();
    });
  };

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Users size={25} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-foreground">
              کاربران و واحدهای سازمانی
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              دسته‌بندی افراد و کنترل فرم‌های قابل مشاهده
            </p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="h-11 gap-2 rounded-xl bg-primary px-5 hover:bg-primary/90"
        >
          <Plus size={18} />
          کاربر جدید
        </Button>
      </div>

      {error && editing === undefined && !accessEditor && (
        <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-primary">
          {error}
        </div>
      )}

      <section className="mb-7 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <Building2 className="text-primary" />
          <div>
            <h3 className="text-lg font-extrabold text-foreground">
              مدیریت واحدهای سازمانی
            </h3>
            <p className="text-xs text-muted-foreground">
              واحد جدید بسازید، نام آن را تغییر دهید یا دسترسی فرم‌های کل واحد را مشخص کنید.
            </p>
          </div>
        </div>
        <form
          ref={departmentFormRef}
          onSubmit={saveDepartment}
          className="mb-5 grid gap-3 rounded-2xl bg-muted/40 p-4 md:grid-cols-[1fr_1.5fr_auto]"
        >
          <Input
            value={departmentName}
            onChange={(event) => setDepartmentName(event.target.value)}
            placeholder="نام واحد سازمانی"
            required
            className="h-11 rounded-xl bg-card"
          />
          <Input
            value={departmentDescription}
            onChange={(event) => setDepartmentDescription(event.target.value)}
            placeholder="توضیح (اختیاری)"
            className="h-11 rounded-xl bg-card"
          />
          <div className="flex gap-2">
            {editingDepartment && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingDepartment(null);
                  setDepartmentName("");
                  setDepartmentDescription("");
                }}
                className="h-11 rounded-xl"
              >
                انصراف
              </Button>
            )}
            <Button
              disabled={saving}
              className="h-11 gap-2 rounded-xl bg-slate-800 hover:bg-slate-900"
            >
              <Plus size={16} />
              {editingDepartment ? "ذخیره تغییرات" : "افزودن واحد"}
            </Button>
          </div>
        </form>
        {departmentFeedback && (
          <div
            className={`mb-5 rounded-2xl border p-4 text-sm font-semibold ${
              departmentFeedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-primary/30 bg-primary/10 text-primary"
            }`}
          >
            {departmentFeedback.text}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((department) => (
            <div
              key={department.id}
              className="rounded-2xl border border-border p-4"
            >
              <div>
                <div>
                  <p className="font-bold text-foreground">{department.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {department.user_count.toLocaleString("fa-IR")} کاربر
                    {department.access_configured
                      ? " · دسترسی اختصاصی"
                      : " · همه فرم‌ها"}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void openAccess({
                        kind: "department",
                        id: department.id,
                        title: department.name,
                      })
                    }
                    className="gap-1 rounded-xl text-emerald-700"
                    aria-label="دسترسی فرم‌ها"
                  >
                    <ShieldCheck size={15} />
                    دسترسی
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => beginDepartmentEdit(department)}
                    className="gap-1 rounded-xl text-blue-600"
                    aria-label="ویرایش واحد"
                  >
                    <Edit3 size={14} />
                    ویرایش
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void removeDepartment(department)}
                    className="gap-1 rounded-xl text-primary"
                    aria-label="حذف واحد"
                  >
                    <Trash2 size={14} />
                    حذف
                  </Button>
                </div>
              </div>
              {department.description && (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {department.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">همه کاربران</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">
            {users.length.toLocaleString("fa-IR")}
          </p>
        </section>
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
          <p className="text-sm text-emerald-700">کاربران فعال</p>
          <p className="mt-1 text-3xl font-extrabold text-emerald-900">
            {users
              .filter((item) => item.is_active)
              .length.toLocaleString("fa-IR")}
          </p>
        </section>
        <section className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-sm text-blue-700">واحدهای سازمانی</p>
          <p className="mt-1 text-3xl font-extrabold text-blue-900">
            {departments.length.toLocaleString("fa-IR")}
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5">
          <div className="relative max-w-lg">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجو بر اساس نام، نام کاربری، ایمیل یا واحد..."
              className="h-11 rounded-xl pr-10"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="animate-spin text-primary" />
            در حال دریافت کاربران...
          </div>
        ) : (
          <div className="space-y-6 p-4 sm:p-5">
            {groupedUsers.map(({ department, users: departmentUsers }) => (
              <div
                key={department.id}
                className="overflow-hidden rounded-2xl border border-border"
              >
                <div className="flex items-center justify-between bg-muted/40 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-primary" />
                    <h3 className="font-extrabold text-foreground">
                      {department.name}
                    </h3>
                    <Badge variant="outline">
                      {departmentUsers.length.toLocaleString("fa-IR")} نفر
                    </Badge>
                  </div>
                </div>
                {departmentUsers.length ? (
                  <div className="overflow-x-auto">
                    <Table className="min-w-full text-sm">
                      <thead className="border-y border-border text-muted-foreground">
                        <tr>
                          <th className="px-5 py-3 text-right">کاربر</th>
                          <th className="px-5 py-3 text-right">سمت و دسته‌بندی</th>
                          <th className="px-5 py-3 text-right">آخرین ورود</th>
                          <th className="px-5 py-3 text-right">وضعیت</th>
                          <th className="px-5 py-3 text-left">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {departmentUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-muted/40">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <UserAvatar
                                  name={formatUserDisplayName(user)}
                                  avatarUrl={user.avatar_url}
                                  className="h-11 w-11 rounded-xl"
                                />
                                <div>
                                  <p className="font-bold text-foreground">
                                    <UserDisplayName user={user} fallback="بدون نام" />
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                                    {user.username}
                                    {user.email ? ` · ${user.email}` : ""}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-foreground">
                                {user.job_title || "—"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {user.category || "—"}
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                              {formatDate(user.last_login)}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2">
                                {user.is_active ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                    <UserCheck className="ml-1" size={13} />
                                    فعال
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">غیرفعال</Badge>
                                )}
                                {user.is_letter_recipient && (
                                  <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                                    گیرنده نامه برون‌سازمانی
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() =>
                                    void openAccess({
                                      kind: "user",
                                      id: user.id,
                                      title: formatUserDisplayName(user),
                                    })
                                  }
                                  className="h-9 w-9 rounded-xl text-emerald-600"
                                  aria-label="دسترسی فرم‌ها"
                                >
                                  <KeyRound size={15} />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => openEdit(user)}
                                  className="h-9 w-9 rounded-xl text-blue-600"
                                  aria-label="ویرایش"
                                >
                                  <Edit3 size={15} />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => void removeUser(user)}
                                  className="h-9 w-9 rounded-xl border-primary/30 text-primary"
                                  aria-label="حذف"
                                >
                                  <Trash2 size={15} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    کاربری در این واحد وجود ندارد.
                  </p>
                )}
              </div>
            ))}
            {!groupedUsers.length && (
              <p className="p-12 text-center text-muted-foreground">
                کاربری با این مشخصات پیدا نشد.
              </p>
            )}
          </div>
        )}
      </section>

      {editing !== undefined && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={() => setEditing(undefined)}
        >
          <form
            onSubmit={saveUser}
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/95 p-6 backdrop-blur">
              <div>
                <h3 className="text-xl font-extrabold text-foreground">
                  {editing ? "ویرایش کاربر" : "ایجاد کاربر جدید"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  واحد کاربر را از فهرست واحدهای مدیریت‌شده انتخاب کنید.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setEditing(undefined)}
              >
                <X size={20} />
              </Button>
            </div>
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              {error && (
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary sm:col-span-2">
                  {error}
                </div>
              )}
              <Label className="text-sm font-semibold text-foreground">
                نام و نام خانوادگی
                <Input
                  value={form.display_name}
                  onChange={(event) =>
                    update("display_name", event.target.value)
                  }
                  className="mt-2 h-11 rounded-xl"
                />
              </Label>
              <Label className="text-sm font-semibold text-foreground">
                نام کاربری
                <Input
                  value={form.username}
                  onChange={(event) => update("username", event.target.value)}
                  required
                  dir="ltr"
                  className="mt-2 h-11 rounded-xl text-left"
                />
              </Label>
              <Label className="text-sm font-semibold text-foreground">
                {editing ? "رمز عبور جدید (اختیاری)" : "رمز عبور"}
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => update("password", event.target.value)}
                  required={!editing}
                  minLength={8}
                  dir="ltr"
                  className="mt-2 h-11 rounded-xl text-left"
                />
              </Label>
              <Label className="text-sm font-semibold text-foreground">
                ایمیل
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  dir="ltr"
                  className="mt-2 h-11 rounded-xl text-left"
                />
              </Label>
              <Label className="text-sm font-semibold text-foreground">
                واحد سازمانی
                <NativeSelect
                  value={form.department_id ?? ""}
                  onChange={(event) =>
                    update(
                      "department_id",
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3"
                >
                  <option value="">بدون واحد</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </NativeSelect>
              </Label>
              <Label className="text-sm font-semibold text-foreground">
                سمت شغلی
                <Input
                  value={form.job_title}
                  onChange={(event) => update("job_title", event.target.value)}
                  className="mt-2 h-11 rounded-xl"
                />
              </Label>
              <Label className="text-sm font-semibold text-foreground">
                دسته‌بندی
                <Input
                  value={form.category}
                  onChange={(event) => update("category", event.target.value)}
                  className="mt-2 h-11 rounded-xl"
                />
              </Label>
              <Label className="text-sm font-semibold text-foreground">
                شماره داخلی
                <Input
                  value={form.extension}
                  onChange={(event) => update("extension", event.target.value)}
                  dir="ltr"
                  className="mt-2 h-11 rounded-xl text-left"
                />
              </Label>
              <Label className="flex items-center gap-3 rounded-2xl border border-border p-4 text-sm font-semibold text-foreground">
                <Input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => update("is_active", event.target.checked)}
                  className="h-4 w-4 accent-red-600"
                />
                حساب فعال باشد
              </Label>
              <Label className="flex items-center gap-3 rounded-2xl border border-border p-4 text-sm font-semibold text-foreground">
                <Input
                  type="checkbox"
                  checked={form.is_admin}
                  onChange={(event) => update("is_admin", event.target.checked)}
                  className="h-4 w-4 accent-red-600"
                />
                حساب مدیر سیستم
              </Label>
              <Label className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm font-semibold text-foreground">
                <Input
                  type="checkbox"
                  checked={form.is_letter_recipient}
                  onChange={(event) =>
                    update("is_letter_recipient", event.target.checked)
                  }
                  className="h-4 w-4 accent-indigo-600"
                />
                <span>
                  <span className="block">دریافت‌کننده نامه‌های برون‌سازمانی</span>
                  <span className="mt-1 block text-xs font-medium text-muted-foreground">
                    در فهرست گیرندگان نامه‌های برون‌سازمانی نمایش داده می‌شود؛ فهرست نامه‌های درون‌سازمانی شامل همه کاربران فعال است
                  </span>
                </span>
              </Label>
              <Label className="flex items-center gap-3 rounded-2xl border border-border p-4 text-sm font-semibold text-foreground">
                <Input
                  type="checkbox"
                  checked={form.must_change_password}
                  onChange={(event) =>
                    update("must_change_password", event.target.checked)
                  }
                  className="h-4 w-4 accent-red-600"
                />
                تغییر رمز در ورود بعدی
              </Label>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-card/95 p-5 backdrop-blur">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(undefined)}
              >
                انصراف
              </Button>
              <Button
                disabled={saving}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                {saving && <Loader2 className="animate-spin" size={16} />}
                ذخیره
              </Button>
            </div>
          </form>
        </div>
      )}

      {accessEditor && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={() => setAccessEditor(null)}
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/95 p-6 backdrop-blur">
              <div>
                <h3 className="text-xl font-extrabold text-foreground">
                  دسترسی فرم‌ها: {accessEditor.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  دسترسی اختصاصی کاربر بر تنظیمات واحد سازمانی اولویت دارد.
                  دسترسی کارت‌های «نامه‌های درون‌سازمانی» و «نامه‌های برون‌سازمانی»
                  به‌صورت مستقل از همین فهرست قابل انتخاب است.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAccessEditor(null)}
              >
                <X size={20} />
              </Button>
            </div>
            {accessLoading ? (
              <div className="flex min-h-64 items-center justify-center">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              <div className="p-6">
                {accessError && (
                  <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm font-semibold text-primary">
                    {accessError}
                  </div>
                )}
                <Label className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <Input
                    type="checkbox"
                    checked={accessConfigured}
                    onChange={(event) =>
                      setAccessConfigured(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 accent-red-600"
                  />
                  <span>
                    <span className="block font-bold text-foreground">
                      استفاده از فهرست دسترسی اختصاصی
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      با غیرفعال‌کردن، واحد همه فرم‌ها را می‌بیند و کاربر از
                      تنظیمات واحد خود ارث می‌برد.
                    </span>
                  </span>
                </Label>
                <div
                  className={`grid gap-4 md:grid-cols-2 ${!accessConfigured ? "pointer-events-none opacity-50" : ""}`}
                >
                  {catalogGroups.map(([title, targets]) => (
                    <section
                      key={title}
                      className="rounded-2xl border border-border p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-extrabold text-foreground">
                          {title}
                        </h4>
                        <Button
                          type="button"
                          onClick={() =>
                            setSelectedTargets((current) => {
                              const next = new Set(current);
                              const keys = targets.map(targetKey);
                              const allSelected = keys.every((key) =>
                                next.has(key),
                              );
                              keys.forEach((key) =>
                                allSelected ? next.delete(key) : next.add(key),
                              );
                              return next;
                            })
                          }
                          className="text-xs font-bold text-primary"
                        >
                          انتخاب همه
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {targets.map((target) => {
                          const key = targetKey(target);
                          return (
                            <Label
                              key={key}
                              className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 text-sm"
                            >
                              <Input
                                type="checkbox"
                                checked={selectedTargets.has(key)}
                                onChange={() => toggleTarget(key)}
                                className="h-4 w-4 accent-red-600"
                              />
                              {target.section_title}
                            </Label>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}
            <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-card/95 p-5 backdrop-blur">
              <Button variant="outline" onClick={() => setAccessEditor(null)}>
                انصراف
              </Button>
              <Button
                onClick={() => void saveAccess()}
                disabled={accessLoading || Boolean(accessError)}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                {accessLoading && <Loader2 className="animate-spin" size={16} />}
                ذخیره دسترسی
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
