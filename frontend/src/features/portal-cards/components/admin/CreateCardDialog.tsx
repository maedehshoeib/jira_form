"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createCard, requestErrorMessage } from "../../api";
import {
  CARD_KIND_HINTS,
  CARD_KIND_LABELS,
  type CardKind,
  type PortalCardAdminDetail,
} from "../../types";
import LogoPicker from "./LogoPicker";

type Props = {
  parentId: number | null;
  parentTitle: string | null;
  onClose: () => void;
  onCreated: (card: PortalCardAdminDetail) => void;
};

const KINDS: CardKind[] = ["group", "form", "document"];

export default function CreateCardDialog({ parentId, parentTitle, onClose, onCreated }: Props) {
  const [kind, setKind] = useState<CardKind>("group");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title.trim()) {
      setError("عنوان کارت را وارد کنید.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await createCard({
        kind,
        title,
        description,
        is_published: published,
        parent_id: parentId,
        logo,
      });
      onCreated(created);
    } catch (err) {
      setError(requestErrorMessage(err, "ساخت کارت انجام نشد."));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>افزودن کارت جدید</DialogTitle>
          <DialogDescription>
            محل قرارگیری: {parentTitle ? `داخل «${parentTitle}»` : "صفحه اصلی"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="نوع کارت">
          {KINDS.map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={kind === item}
              onClick={() => setKind(item)}
              className={`rounded-xl border p-3 text-start transition ${
                kind === item ? "border-primary bg-primary/10" : "hover:bg-muted"
              }`}
            >
              <span className="block text-sm font-bold">{CARD_KIND_LABELS[item]}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{CARD_KIND_HINTS[item]}</span>
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="new-card-title">عنوان</Label>
          <Input id="new-card-title" value={title} maxLength={128} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-card-description">توضیح کوتاه (اختیاری)</Label>
          <Textarea
            id="new-card-description"
            rows={2}
            maxLength={512}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <LogoPicker file={logo} onFile={setLogo} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={published} onCheckedChange={(checked) => setPublished(checked === true)} />
          همین حالا برای کاربرانی که دسترسی باز دارند نمایش داده شود
        </label>
        <p className="text-xs text-muted-foreground">
          اگر این گزینه خاموش باشد کارت پیش‌نویس است. پیش‌نویس فقط برای مدیر و
          کاربرانی دیده می‌شود که در دسترسی فرم‌ها یا مسیریابی وظایف به آن‌ها داده شده است.
        </p>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2 sm:justify-start">
          <Button type="button" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} ساخت کارت
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
