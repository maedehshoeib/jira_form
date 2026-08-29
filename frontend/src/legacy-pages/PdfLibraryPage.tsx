import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Eye,
  FilePlus2,
  FileText,
  FolderOpen,
  GraduationCap,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import client from "../api/client";
import { endpoints } from "../api/endpoints";
import AppShell from "../components/layout/AppShell";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import {
  downloadBlob,
  getPdfBlob,
  PDF_LIBRARY_CONFIG,
  PdfFormItem,
  PdfLibraryCategory,
  PdfLibraryConfig,
} from "../features/pdfForms";

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 0 })} کیلوبایت`
    : `${(bytes / 1024 / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;

const CATEGORY_ICONS = {
  forms: FileText,
  training: GraduationCap,
  guidelines: FileText,
  documents: FolderOpen,
} as const;

type EditorMode = "create" | "edit";

type PdfLibraryPageProps = {
  category: PdfLibraryCategory;
};

export default function PdfLibraryPage({ category }: PdfLibraryPageProps) {
  const config = PDF_LIBRARY_CONFIG[category];
  const Icon = CATEGORY_ICONS[category];
  const { user } = useAuth();
  const [items, setItems] = useState<PdfFormItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [viewer, setViewer] = useState<{ title: string; url: string } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingItem, setEditingItem] = useState<PdfFormItem | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    client
      .get<PdfFormItem[]>(endpoints.pdfForms, { params: { category } })
      .then(({ data }) => setItems(data))
      .catch(() => setError(`دریافت فهرست ${config.singular}‌ها با مشکل مواجه شد.`))
      .finally(() => setLoading(false));
  }, [category, config.singular]);

  useEffect(
    () => () => {
      if (viewer) URL.revokeObjectURL(viewer.url);
    },
    [viewer],
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fa");
    if (!normalized) return items;
    return items.filter(
      (item) =>
        item.title.toLocaleLowerCase("fa").includes(normalized) ||
        item.description.toLocaleLowerCase("fa").includes(normalized),
    );
  }, [items, query]);

  const viewItem = async (item: PdfFormItem) => {
    setWorkingId(item.id);
    setError("");
    try {
      const blob = await getPdfBlob(item.id, category);
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

  const downloadItem = async (item: PdfFormItem) => {
    setWorkingId(item.id);
    setError("");
    try {
      downloadBlob(await getPdfBlob(item.id, category), item.file_name);
    } catch {
      setError("دانلود فایل PDF با مشکل مواجه شد.");
    } finally {
      setWorkingId(null);
    }
  };

  const openCreate = () => {
    setEditorMode("create");
    setEditingItem(null);
    setDraftTitle("");
    setDraftDescription("");
    setDraftFile(null);
    setSaveError("");
    setEditorOpen(true);
  };

  const openEdit = (item: PdfFormItem) => {
    setEditorMode("edit");
    setEditingItem(item);
    setDraftTitle(item.title);
    setDraftDescription(item.description || "");
    setDraftFile(null);
    setSaveError("");
    setEditorOpen(true);
  };

  const resetEditor = () => {
    setEditorOpen(false);
    setEditingItem(null);
    setDraftTitle("");
    setDraftDescription("");
    setDraftFile(null);
    setSaveError("");
  };

  const closeEditor = () => {
    if (saving) return;
    resetEditor();
  };

  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    if (editorMode === "create" && !draftFile) {
      setSaveError("لطفاً یک فایل PDF انتخاب کنید.");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const data = new FormData();
      data.append("title", draftTitle);
      data.append("description", draftDescription);
      if (editorMode === "create") {
        data.append("category", category);
        data.append("pdf", draftFile as File);
        const response = await client.post<PdfFormItem>(endpoints.adminPdfForms, data);
        setItems((current) => [response.data, ...current]);
      } else if (editingItem) {
        if (draftFile) data.append("pdf", draftFile);
        const response = await client.put<PdfFormItem>(
          `${endpoints.adminPdfForms}/${editingItem.id}`,
          data,
        );
        setItems((current) =>
          current.map((item) => (item.id === response.data.id ? response.data : item)),
        );
      }
      resetEditor();
    } catch (requestError: any) {
      setSaveError(
        requestError.response?.data?.detail ||
          `ذخیره ${config.singular} با مشکل مواجه شد.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: PdfFormItem) => {
    if (!window.confirm(`آیا از حذف «${item.title}» مطمئن هستید؟`)) return;

    setWorkingId(item.id);
    setError("");
    try {
      await client.delete(`${endpoints.adminPdfForms}/${item.id}`);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (editingItem?.id === item.id) resetEditor();
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.detail ||
          `حذف ${config.singular} با مشکل مواجه شد.`,
      );
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <AppShell>
      <div dir="rtl">
        <div className="mb-6">
          <Link
            to="/"
            className="rounded-full border border-border bg-muted/40 px-5 py-2.5 font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary dark:border-white/20 dark:bg-card/[0.08] dark:text-white/80 dark:backdrop-blur dark:hover:border-red-300/60 dark:hover:bg-primary/20 dark:hover:text-white"
          >
            بازگشت
          </Link>
        </div>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl ${config.accent.iconBg} ${config.accent.iconText}`}
            >
              <Icon size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-foreground">{config.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {user?.is_admin && (
              <Button
                type="button"
                onClick={openCreate}
                className={`h-12 gap-2 rounded-2xl px-5 text-white ${config.accent.button} ${config.accent.buttonHover}`}
              >
                <FilePlus2 size={19} />
                {config.addLabel}
              </Button>
            )}
            <Label className="relative block w-full sm:w-80">
              <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={config.searchPlaceholder}
                className={`h-12 w-full rounded-2xl border border-border bg-card pr-12 pl-4 text-sm outline-none transition focus:ring-4 ${config.accent.focusBorder} ${config.accent.focusRing}`}
              />
            </Label>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[45vh] items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className={`animate-spin ${config.accent.iconText}`} />
            {config.loadingLabel}
          </div>
        ) : filteredItems.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <LibraryCard
                key={item.id}
                item={item}
                config={config}
                Icon={Icon}
                isAdmin={Boolean(user?.is_admin)}
                working={workingId === item.id}
                onView={() => viewItem(item)}
                onDownload={() => downloadItem(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => deleteItem(item)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card text-center text-muted-foreground">
            <Icon size={48} strokeWidth={1.4} />
            <p className="mt-4 font-bold text-muted-foreground">
              {query ? config.notFoundLabel : config.emptyLabel}
            </p>
          </div>
        )}
      </div>

      {editorOpen && user?.is_admin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdf-library-editor-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        >
          <form
            dir="rtl"
            onSubmit={saveItem}
            className="w-full max-w-xl rounded-3xl bg-card p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${config.accent.iconBg} ${config.accent.iconText}`}
                >
                  {editorMode === "create" ? <FilePlus2 size={24} /> : <Pencil size={24} />}
                </div>
                <div>
                  <h2
                    id="pdf-library-editor-title"
                    className="text-xl font-extrabold text-foreground"
                  >
                    {editorMode === "create"
                      ? `${config.addLabel}`
                      : `ویرایش ${config.singular}`}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {editorMode === "create"
                      ? "فایل PDF و اطلاعات مرتبط با آن را وارد کنید."
                      : "عنوان، توضیحات یا فایل PDF را به‌روزرسانی کنید."}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                disabled={saving}
                onClick={closeEditor}
                aria-label="بستن پنجره"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X size={20} />
              </Button>
            </div>

            <div className="space-y-5">
              <Label className="block">
                <span className="mb-2 block text-sm font-bold text-foreground">
                  عنوان {config.singular}
                </span>
                <Input
                  required
                  autoFocus
                  maxLength={256}
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder={`عنوان ${config.singular}`}
                  className={`h-12 w-full rounded-xl border border-border px-4 outline-none transition focus:ring-4 ${config.accent.focusBorder} ${config.accent.focusRing}`}
                />
              </Label>

              <Label className="block">
                <span className="mb-2 block text-sm font-bold text-foreground">توضیحات</span>
                <Textarea
                  rows={3}
                  maxLength={2000}
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  placeholder={`توضیح کوتاهی درباره ${config.singular}`}
                  className={`w-full resize-none rounded-xl border border-border px-4 py-3 outline-none transition focus:ring-4 ${config.accent.focusBorder} ${config.accent.focusRing}`}
                />
              </Label>

              <Label className="block">
                <span className="mb-2 block text-sm font-bold text-foreground">
                  فایل PDF
                  {editorMode === "edit" && (
                    <span className="mr-2 font-normal text-muted-foreground">
                      (اختیاری — برای جایگزینی فایل)
                    </span>
                  )}
                </span>
                <span className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 text-center transition hover:border-border hover:bg-muted/70">
                  <Upload size={23} className={`mb-2 ${config.accent.iconText}`} />
                  <span className="max-w-full truncate text-sm font-bold text-foreground">
                    {draftFile?.name ||
                      (editorMode === "edit"
                        ? editingItem?.file_name || "برای جایگزینی فایل کلیک کنید"
                        : "برای انتخاب فایل کلیک کنید")}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">PDF، حداکثر ۲۰ مگابایت</span>
                  <Input
                    type="file"
                    required={editorMode === "create"}
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(event) => setDraftFile(event.target.files?.[0] || null)}
                  />
                </span>
              </Label>
            </div>

            {saveError && (
              <div className="mt-5 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                {saveError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={closeEditor}
                className="h-11 rounded-xl px-5"
              >
                انصراف
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className={`h-11 gap-2 rounded-xl px-6 text-white ${config.accent.button} ${config.accent.buttonHover}`}
              >
                {saving ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : editorMode === "create" ? (
                  <Upload size={17} />
                ) : (
                  <Pencil size={17} />
                )}
                {editorMode === "create" ? "بارگذاری و انتشار" : "ذخیره تغییرات"}
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
          <div
            dir="rtl"
            className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-t-2xl bg-card px-4 py-3"
          >
            <h2 className="truncate font-extrabold text-foreground">{viewer.title}</h2>
            <Button
              type="button"
              aria-label="بستن نمایش"
              onClick={() => setViewer(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X size={21} />
            </Button>
          </div>
          <iframe
            src={viewer.url}
            title={viewer.title}
            className="mx-auto h-full w-full max-w-6xl rounded-b-2xl bg-card"
          />
        </div>
      )}
    </AppShell>
  );
}

function LibraryCard({
  item,
  config,
  Icon,
  isAdmin,
  working,
  onView,
  onDownload,
  onEdit,
  onDelete,
}: {
  item: PdfFormItem;
  config: PdfLibraryConfig;
  Icon: typeof FileText;
  isAdmin: boolean;
  working: boolean;
  onView: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex min-h-64 flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${config.accent.iconBg} ${config.accent.iconText}`}
        >
          <Icon size={23} />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button
                type="button"
                disabled={working}
                onClick={onEdit}
                aria-label={`ویرایش ${item.title}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
              >
                <Pencil size={16} />
              </Button>
              <Button
                type="button"
                disabled={working}
                onClick={onDelete}
                aria-label={`حذف ${item.title}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-card text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
              >
                <Trash2 size={16} />
              </Button>
            </>
          )}
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            PDF · {fileSize(item.file_size)}
          </span>
        </div>
      </div>
      <h2 className="mt-5 text-lg font-extrabold text-foreground">{item.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
        {item.description || config.defaultItemDescription}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={working}
          onClick={onView}
          className="h-11 gap-2 rounded-xl"
        >
          {working ? <Loader2 size={17} className="animate-spin" /> : <Eye size={17} />}
          مشاهده
        </Button>
        <Button
          type="button"
          disabled={working}
          onClick={onDownload}
          className={`h-11 gap-2 rounded-xl text-white ${config.accent.button} ${config.accent.buttonHover}`}
        >
          <Download size={17} />
          دانلود
        </Button>
      </div>
    </article>
  );
}
