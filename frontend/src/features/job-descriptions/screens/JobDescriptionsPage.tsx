"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, FilePlus2, Loader2, Search } from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

import {
  createJobDescription,
  deleteJobDescription,
  downloadJobDescriptionAttachment,
  listJobDescriptions,
  updateJobDescription,
} from "../api";
import JobDescriptionCard from "../components/JobDescriptionCard";
import JobDescriptionDetail from "../components/JobDescriptionDetail";
import JobDescriptionEditor from "../components/JobDescriptionEditor";
import {
  emptyJobDescriptionDraft,
  type JobDescriptionDraft,
  type JobDescriptionItem,
} from "../types";

type EditorMode = "create" | "edit";

export default function JobDescriptionsPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_admin);
  const [items, setItems] = useState<JobDescriptionItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<JobDescriptionItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingItem, setEditingItem] = useState<JobDescriptionItem | null>(null);
  const [draft, setDraft] = useState<JobDescriptionDraft>(emptyJobDescriptionDraft());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    listJobDescriptions()
      .then(setItems)
      .catch(() => setError("دریافت فهرست شرح وظایف با مشکل مواجه شد."))
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fa");
    if (!normalized) return items;
    return items.filter((item) =>
      [
        item.organizational_position,
        item.organizational_unit,
        item.unit_responsibility,
        item.qualification_requirements,
      ].some((value) => value.toLocaleLowerCase("fa").includes(normalized)),
    );
  }, [items, query]);

  const openCreate = () => {
    setEditorMode("create");
    setEditingItem(null);
    setDraft(emptyJobDescriptionDraft());
    setSaveError("");
    setEditorOpen(true);
  };

  const openEdit = (item: JobDescriptionItem) => {
    setEditorMode("edit");
    setEditingItem(item);
    setDraft({
      organizational_position: item.organizational_position,
      organizational_unit: item.organizational_unit,
      unit_responsibility: item.unit_responsibility,
      qualification_requirements: item.qualification_requirements,
      photo: null,
      attachment: null,
      remove_photo: false,
      remove_attachment: false,
    });
    setSaveError("");
    setEditorOpen(true);
  };

  const resetEditor = () => {
    setEditorOpen(false);
    setEditingItem(null);
    setDraft(emptyJobDescriptionDraft());
    setSaveError("");
  };

  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      if (editorMode === "create") {
        const created = await createJobDescription(draft);
        setItems((current) => [created, ...current]);
      } else if (editingItem) {
        const updated = await updateJobDescription(editingItem.id, draft);
        setItems((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        if (selected?.id === updated.id) setSelected(updated);
      }
      resetEditor();
    } catch (requestError: unknown) {
      const detail =
        typeof requestError === "object" &&
        requestError &&
        "response" in requestError
          ? (requestError as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : undefined;
      setSaveError(detail || "ذخیره شرح وظایف با مشکل مواجه شد.");
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item: JobDescriptionItem) => {
    if (!window.confirm(`آیا از حذف «${item.organizational_position}» مطمئن هستید؟`)) {
      return;
    }
    setWorkingId(item.id);
    setError("");
    try {
      await deleteJobDescription(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (selected?.id === item.id) setSelected(null);
      if (editingItem?.id === item.id) resetEditor();
    } catch (requestError: unknown) {
      const detail =
        typeof requestError === "object" &&
        requestError &&
        "response" in requestError
          ? (requestError as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : undefined;
      setError(detail || "حذف شرح وظایف با مشکل مواجه شد.");
    } finally {
      setWorkingId(null);
    }
  };

  const downloadAttachment = async (item: JobDescriptionItem) => {
    if (!item.has_attachment) return;
    setWorkingId(item.id);
    setError("");
    try {
      await downloadJobDescriptionAttachment(item);
    } catch {
      setError("دانلود فایل پیوست با مشکل مواجه شد.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <AppShell>
      <div dir="rtl">
        <div className="mb-6">
          <Link
            href="/"
            className="rounded-full border border-border bg-muted/40 px-5 py-2.5 font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
          >
            بازگشت
          </Link>
        </div>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <BriefcaseBusiness size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-foreground">شرح وظایف</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                مشاهده سمت‌ها، واحدها و شرایط احراز سازمانی
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {isAdmin && (
              <Button
                type="button"
                onClick={openCreate}
                className="h-12 gap-2 rounded-2xl bg-emerald-600 px-5 text-white hover:bg-emerald-700"
              >
                <FilePlus2 size={19} />
                افزودن شرح وظایف
              </Button>
            )}
            <Label className="relative block w-full sm:w-80">
              <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="جستجو در شرح وظایف"
                className="h-12 w-full rounded-2xl border border-border bg-card pr-12 pl-4 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
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
            <Loader2 className="animate-spin text-emerald-600" />
            در حال دریافت شرح وظایف...
          </div>
        ) : filteredItems.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <JobDescriptionCard
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                working={workingId === item.id}
                onView={() => setSelected(item)}
                onDownload={() => downloadAttachment(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => removeItem(item)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card text-center text-muted-foreground">
            <BriefcaseBusiness size={48} strokeWidth={1.4} />
            <p className="mt-4 font-bold text-muted-foreground">
              {query ? "موردی با این عبارت پیدا نشد." : "هنوز شرح وظایفی منتشر نشده است."}
            </p>
          </div>
        )}
      </div>

      {editorOpen && isAdmin && (
        <JobDescriptionEditor
          mode={editorMode}
          draft={draft}
          editingItem={editingItem}
          saving={saving}
          saveError={saveError}
          onChange={setDraft}
          onClose={() => {
            if (!saving) resetEditor();
          }}
          onSubmit={saveItem}
        />
      )}

      {selected && (
        <JobDescriptionDetail
          item={selected}
          onClose={() => setSelected(null)}
          onDownload={() => downloadAttachment(selected)}
        />
      )}
    </AppShell>
  );
}
