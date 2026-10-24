"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Save, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { removeCardFile, requestErrorMessage, saveCardContent, uploadCardFile } from "../../api";
import type { PortalCardAdminDetail } from "../../types";

type Props = {
  card: PortalCardAdminDetail;
  onSaved: (card: PortalCardAdminDetail) => void;
};

export default function DocumentEditor({ card, onSaved }: Props) {
  const [content, setContent] = useState(card.content);
  const [fileTitle, setFileTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"content" | "upload" | number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function run<T>(key: typeof busy, action: () => Promise<T>, message: string) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const result = await action();
      setNotice(message);
      return result;
    } catch (err) {
      setError(requestErrorMessage(err, "عملیات انجام نشد."));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function saveContent() {
    const saved = await run("content", () => saveCardContent(card.id, content), "متن ذخیره شد.");
    if (saved) onSaved(saved);
  }

  async function upload() {
    if (!file) return;
    const title = fileTitle.trim() || file.name;
    const saved = await run("upload", () => uploadCardFile(card.id, title, file), "فایل افزوده شد.");
    if (saved) {
      onSaved(saved);
      setFile(null);
      setFileTitle("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(fileId: number) {
    if (!window.confirm("این فایل حذف شود؟")) return;
    const saved = await run(fileId, () => removeCardFile(card.id, fileId), "فایل حذف شد.");
    if (saved) onSaved(saved);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="card-content">متن مستند</Label>
        <Textarea
          id="card-content"
          rows={10}
          maxLength={50000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <Button type="button" onClick={saveContent} disabled={busy === "content"}>
          {busy === "content" ? <Loader2 className="animate-spin" /> : <Save />} ذخیره متن
        </Button>
      </div>

      <div className="space-y-3 rounded-3xl border border-primary/15 bg-card p-4">
        <h3 className="font-bold">فایل‌های پیوست</h3>
        {card.files.length === 0 && <p className="text-sm text-muted-foreground">فایلی ثبت نشده است.</p>}
        <ul className="space-y-2">
          {card.files.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3">
              <span className="flex min-w-0 items-center gap-2">
                <FileText size={18} className="shrink-0 text-primary" />
                <span className="truncate text-sm">{item.title}</span>
              </span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="حذف فایل"
                disabled={busy === item.id} onClick={() => remove(item.id)}>
                <Trash2 className="text-destructive" />
              </Button>
            </li>
          ))}
        </ul>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label>عنوان فایل</Label>
            <Input value={fileTitle} maxLength={128} onChange={(event) => setFileTitle(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>فایل (حداکثر ۲۰ مگابایت)</Label>
            <Input ref={fileInput} type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </div>
          <Button type="button" onClick={upload} disabled={!file || busy === "upload"}>
            {busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload />} افزودن
          </Button>
        </div>
      </div>

      {notice && <p className="text-sm text-emerald-600">{notice}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
