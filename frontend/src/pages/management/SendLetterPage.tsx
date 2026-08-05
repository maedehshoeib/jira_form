import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Paperclip,
  Search,
  Send,
  X,
} from "lucide-react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import AppShell from "../../components/layout/AppShell";
import UserDisplayName from "../../components/UserDisplayName";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { API_BASE } from "../../config/portal";

type LetterRecipient = {
  id: number;
  username: string;
  display_name: string;
  department: string;
  job_title: string;
  birth_date?: string | null;
  is_birthday?: boolean;
};

function apiErrorDetail(err: unknown, fallback: string) {
  if (!err || typeof err !== "object" || !("response" in err)) return fallback;
  const detail = (err as { response?: { data?: { detail?: unknown } } }).response
    ?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  return fallback;
}

export default function SendLetterPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [recipients, setRecipients] = useState<LetterRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const access = await client.get<{ allowed: boolean }>(
          endpoints.managementLetterAccess,
        );
        if (!active) return;
        setAllowed(access.data.allowed);
        if (!access.data.allowed) return;
        const { data } = await client.get<LetterRecipient[]>(
          endpoints.managementLetterRecipients,
        );
        if (!active) return;
        setRecipients(data);
      } catch {
        if (active) {
          setAllowed(false);
          setError("دریافت اطلاعات ارسال نامه با مشکل مواجه شد.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const filteredRecipients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fa");
    if (!query) return recipients;
    return recipients.filter((user) =>
      [user.display_name, user.username, user.department, user.job_title]
        .join(" ")
        .toLocaleLowerCase("fa")
        .includes(query),
    );
  }, [recipients, search]);

  const toggleRecipient = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!subject.trim() || !description.trim()) {
      setError("موضوع و توضیحات الزامی است.");
      return;
    }
    if (selectedIds.size === 0) {
      setError("حداقل یک گیرنده را انتخاب کنید.");
      return;
    }

    setSaving(true);
    setError("");
    setDone(false);

    const fd = new FormData();
    fd.append("subject", subject.trim());
    fd.append("description", description.trim());
    fd.append("recipient_ids", JSON.stringify([...selectedIds]));
    if (attachment) fd.append("attachment", attachment);

    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_BASE}${endpoints.managementLetters}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(
          typeof payload?.detail === "string"
            ? payload.detail
            : "ارسال نامه انجام نشد.",
        );
      }
      setDone(true);
      setSubject("");
      setDescription("");
      setAttachment(null);
      setSelectedIds(new Set());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : apiErrorDetail(requestError, "ارسال نامه انجام نشد."),
      );
    } finally {
      setSaving(false);
    }
  };

  if (allowed === false) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <Link
          to="/management-workflow"
          className="inline-flex items-center gap-2 font-semibold text-red-600 hover:text-red-700"
        >
          <ChevronLeft size={18} />
          بازگشت
        </Link>

        <div className="mt-8 mb-8 rounded-3xl bg-white p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Send size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">ارسال نامه</h1>
              <p className="mt-1 text-sm text-slate-500">
                مشابه فرم عمومی؛ پس از ارسال برای گیرندگان به‌صورت وظیفه ثبت می‌شود
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-3xl bg-white shadow-sm">
            <Loader2 className="animate-spin text-red-600" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl"
          >
            {done && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                <CheckCircle2 size={20} />
                نامه با موفقیت ارسال شد و در وظایف گیرندگان قرار گرفت.
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                موضوع درخواست
              </label>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
                className="h-12 rounded-xl"
                placeholder="موضوع نامه"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                توضیحات
              </label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                rows={6}
                className="rounded-xl"
                placeholder="شرح نامه"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                پیوست
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <Paperclip size={16} />
                  انتخاب فایل
                  <input
                    type="file"
                    className="hidden"
                    onChange={(event) =>
                      setAttachment(event.target.files?.[0] || null)
                    }
                  />
                </label>
                {attachment && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {attachment.name}
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="حذف پیوست"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <label className="text-sm font-bold text-slate-700">
                  گیرندگان نامه
                  <span className="mr-2 text-xs font-medium text-slate-400">
                    ({selectedIds.size.toLocaleString("fa-IR")} انتخاب‌شده)
                  </span>
                </label>
                <div className="relative w-full max-w-xs">
                  <Search
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="جستجوی گیرنده"
                    className="h-10 rounded-xl pr-9"
                  />
                </div>
              </div>

              {recipients.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  هنوز گیرنده‌ای توسط مدیر سیستم مشخص نشده است. از بخش مدیریت کاربران،
                  گزینه «دریافت‌کننده نامه مدیریت» را فعال کنید.
                </div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                  {filteredRecipients.map((user) => {
                    const checked = selectedIds.has(user.id);
                    return (
                      <label
                        key={user.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 text-sm transition ${
                          checked
                            ? "bg-red-50 ring-1 ring-red-200"
                            : "bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRecipient(user.id)}
                          className="h-4 w-4 accent-red-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800">
                            <UserDisplayName user={user} />
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {[user.department, user.job_title]
                              .filter(Boolean)
                              .join(" · ") || user.username}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                  {filteredRecipients.length === 0 && (
                    <p className="p-4 text-center text-sm text-slate-400">
                      گیرنده‌ای با این جستجو یافت نشد.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSubject("");
                  setDescription("");
                  setAttachment(null);
                  setSelectedIds(new Set());
                  setDone(false);
                  setError("");
                }}
                className="rounded-xl"
              >
                پاک کردن
              </Button>
              <Button
                disabled={saving || recipients.length === 0}
                className="gap-2 rounded-xl bg-red-600 px-6 hover:bg-red-700"
              >
                {saving && <Loader2 className="animate-spin" size={16} />}
                ارسال نامه
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
