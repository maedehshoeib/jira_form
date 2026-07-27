import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  FilePlus2,
  FileText,
  Loader2,
  Search,
  Upload,
  X,
} from "lucide-react";

import client from "../api/client";
import { endpoints } from "../api/endpoints";
import AppShell from "../components/layout/AppShell";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { downloadBlob, getPdfBlob, PdfFormItem } from "../features/pdfForms";

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 0 })} کیلوبایت`
    : `${(bytes / 1024 / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;

export default function PdfFormsPage() {
  const { user } = useAuth();
  const [forms, setForms] = useState<PdfFormItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [viewer, setViewer] = useState<{ title: string; url: string } | null>(null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get<PdfFormItem[]>(endpoints.pdfForms)
      .then(({ data }) => setForms(data))
      .catch(() => setError("دریافت فهرست فرم‌ها با مشکل مواجه شد."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(
    () => () => {
      if (viewer) URL.revokeObjectURL(viewer.url);
    },
    [viewer],
  );

  const filteredForms = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fa");
    if (!normalized) return forms;
    return forms.filter(
      (item) =>
        item.title.toLocaleLowerCase("fa").includes(normalized) ||
        item.description.toLocaleLowerCase("fa").includes(normalized),
    );
  }, [forms, query]);

  const viewForm = async (item: PdfFormItem) => {
    setWorkingId(item.id);
    setError("");
    try {
      const blob = await getPdfBlob(item.id);
      setViewer((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { title: item.title, url: URL.createObjectURL(blob) };
      });
    } catch {
      setError("نمایش فایل PDF با مشکل مواجه شد.");
    } finally {
      setWorkingId(null);
    }
  };

  const downloadForm = async (item: PdfFormItem) => {
    setWorkingId(item.id);
    setError("");
    try {
      downloadBlob(await getPdfBlob(item.id), item.file_name);
    } catch {
      setError("دانلود فایل PDF با مشکل مواجه شد.");
    } finally {
      setWorkingId(null);
    }
  };

  const closeAddForm = () => {
    if (uploading) return;
    setAddFormOpen(false);
    setNewTitle("");
    setNewDescription("");
    setNewFile(null);
    setUploadError("");
  };

  const uploadForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!newFile) {
      setUploadError("لطفاً یک فایل PDF انتخاب کنید.");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const data = new FormData();
      data.append("title", newTitle);
      data.append("description", newDescription);
      data.append("pdf", newFile);
      const response = await client.post<PdfFormItem>(endpoints.adminPdfForms, data);
      setForms((current) => [response.data, ...current]);
      setAddFormOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewFile(null);
    } catch (requestError: any) {
      setUploadError(
        requestError.response?.data?.detail || "بارگذاری فرم با مشکل مواجه شد.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppShell>
      <div dir="rtl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <FileText size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900">فرم‌های سازمانی</h1>
              <p className="mt-1 text-sm text-slate-500">
                فرم موردنظر را مشاهده کنید یا نسخه PDF آن را دریافت کنید.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {user?.is_admin && (
              <Button
                type="button"
                onClick={() => setAddFormOpen(true)}
                className="h-12 gap-2 rounded-2xl bg-red-600 px-5 hover:bg-red-700"
              >
                <FilePlus2 size={19} />
                افزودن فرم
              </Button>
            )}
            <label className="relative block w-full sm:w-80">
              <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="جستجو در فرم‌ها"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pr-12 pl-4 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[45vh] items-center justify-center gap-3 text-slate-500">
            <Loader2 className="animate-spin text-red-600" />
            در حال دریافت فرم‌ها...
          </div>
        ) : filteredForms.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredForms.map((item) => (
              <article
                key={item.id}
                className="flex min-h-64 flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                    <FileText size={23} />
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    PDF · {fileSize(item.file_size)}
                  </span>
                </div>
                <h2 className="mt-5 text-lg font-extrabold text-slate-900">{item.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-7 text-slate-500">
                  {item.description || "فرم آماده مشاهده و دریافت است."}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={workingId === item.id}
                    onClick={() => viewForm(item)}
                    className="h-11 gap-2 rounded-xl"
                  >
                    {workingId === item.id ? <Loader2 size={17} className="animate-spin" /> : <Eye size={17} />}
                    مشاهده
                  </Button>
                  <Button
                    type="button"
                    disabled={workingId === item.id}
                    onClick={() => downloadForm(item)}
                    className="h-11 gap-2 rounded-xl bg-red-600 hover:bg-red-700"
                  >
                    <Download size={17} />
                    دانلود
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white text-center text-slate-400">
            <FileText size={48} strokeWidth={1.4} />
            <p className="mt-4 font-bold text-slate-600">
              {query ? "فرمی با این عبارت پیدا نشد." : "هنوز فرمی منتشر نشده است."}
            </p>
          </div>
        )}
      </div>

      {addFormOpen && user?.is_admin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-pdf-form-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        >
          <form
            dir="rtl"
            onSubmit={uploadForm}
            className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <FilePlus2 size={24} />
                </div>
                <div>
                  <h2 id="add-pdf-form-title" className="text-xl font-extrabold text-slate-900">
                    افزودن فرم جدید
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    فایل PDF و اطلاعات مرتبط با آن را وارد کنید.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={closeAddForm}
                aria-label="بستن پنجره افزودن فرم"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">عنوان فرم</span>
                <input
                  required
                  autoFocus
                  maxLength={256}
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="برای مثال: فرم درخواست جلسات"
                  className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">توضیحات</span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="توضیح کوتاهی درباره کاربرد فرم"
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">فایل PDF</span>
                <span className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 text-center transition hover:border-red-300 hover:bg-red-50/40">
                  <Upload size={23} className="mb-2 text-red-600" />
                  <span className="max-w-full truncate text-sm font-bold text-slate-700">
                    {newFile?.name || "برای انتخاب فایل کلیک کنید"}
                  </span>
                  <span className="mt-1 text-xs text-slate-400">PDF، حداکثر ۲۰ مگابایت</span>
                  <input
                    type="file"
                    required={!newFile}
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(event) => setNewFile(event.target.files?.[0] || null)}
                  />
                </span>
              </label>
            </div>

            {uploadError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {uploadError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={closeAddForm}
                className="h-11 rounded-xl px-5"
              >
                انصراف
              </Button>
              <Button
                type="submit"
                disabled={uploading}
                className="h-11 gap-2 rounded-xl bg-red-600 px-6 hover:bg-red-700"
              >
                {uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
                بارگذاری و انتشار
              </Button>
            </div>
          </form>
        </div>
      )}

      {viewer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`نمایش ${viewer.title}`}
          className="fixed inset-0 z-50 flex flex-col bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
        >
          <div dir="rtl" className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-t-2xl bg-white px-4 py-3">
            <h2 className="truncate font-extrabold text-slate-800">{viewer.title}</h2>
            <button
              type="button"
              aria-label="بستن نمایش فرم"
              onClick={() => setViewer(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <X size={21} />
            </button>
          </div>
          <iframe
            src={viewer.url}
            title={viewer.title}
            className="mx-auto h-full w-full max-w-6xl rounded-b-2xl bg-white"
          />
        </div>
      )}
    </AppShell>
  );
}
