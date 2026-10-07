"use client";

import { FormEvent } from "react";
import { CalendarDays, Check, Clock3, MapPin, Trash2, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toLatinDigits } from "@/lib/persianDate";
import { cn } from "@/lib/utils";

import { EVENT_COLORS, type CalendarUser, type EventForm } from "../types";

type Props = {
  form: EventForm;
  setForm: (next: EventForm) => void;
  users: CalendarUser[];
  editingId: number | null;
  saving: boolean;
  error: string;
  createdByOther: boolean;
  onClose: () => void;
  onSave: (event: FormEvent) => void;
  onRemove: () => void;
};

export default function EventEditorSheet({
  form,
  setForm,
  users,
  editingId,
  saving,
  error,
  createdByOther,
  onClose,
  onSave,
  onRemove,
}: Props) {
  const toggleUser = (userId: number, checked: boolean) => {
    if (editingId) {
      if (checked) setForm({ ...form, user_ids: [userId] });
      return;
    }
    const next = checked
      ? [...form.user_ids, userId]
      : form.user_ids.filter((id) => id !== userId);
    setForm({ ...form, user_ids: next });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/35"
      onMouseDown={onClose}
    >
      <form
        onSubmit={onSave}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col bg-card shadow-2xl dark:bg-slate-950"
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-4 dark:border-slate-800">
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            className="rounded p-2 hover:bg-muted dark:hover:bg-slate-800"
          >
            <X size={20} />
          </Button>
          <h2 className="font-bold">{editingId ? "ویرایش رویداد" : "رویداد جدید"}</h2>
          <div className="mr-auto flex gap-2">
            {editingId && (
              <Button
                variant="ghost"
                type="button"
                onClick={onRemove}
                disabled={saving}
                className="rounded p-2 text-primary hover:bg-primary/10"
              >
                <Trash2 size={19} />
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={saving || form.user_ids.length === 0}
              className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              <Check size={17} />
              {saving ? "در حال ذخیره" : "ذخیره"}
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {error && (
            <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">{error}</div>
          )}

          <Input
            autoFocus
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="افزودن عنوان"
            className="w-full border-0 border-b-2 border-blue-600 bg-transparent px-1 py-3 text-2xl font-semibold outline-none"
          />

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <UserRound size={18} />
              {editingId ? "کاربر رویداد" : "کاربران رویداد (چند نفره)"}
            </Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2 dark:border-slate-700">
              {users.map((item) => {
                const checked = form.user_ids.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm hover:bg-muted/60 dark:hover:bg-slate-800",
                      checked && "bg-blue-50 dark:bg-blue-950/40",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleUser(item.id, value === true)}
                    />
                    <span className="truncate">{item.display_name || item.username}</span>
                  </label>
                );
              })}
              {users.length === 0 && (
                <p className="px-2 py-3 text-xs text-muted-foreground">کاربری یافت نشد.</p>
              )}
            </div>
            {!editingId && (
              <p className="text-xs text-muted-foreground">
                برای هر کاربر انتخاب‌شده یک رویداد جدا ذخیره می‌شود.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <CalendarDays className="text-muted-foreground" size={20} />
            <Input
              required
              dir="ltr"
              value={form.jalali_date}
              onChange={(e) =>
                setForm({ ...form, jalali_date: toLatinDigits(e.target.value) })
              }
              placeholder="1405/06/01"
              className="flex-1 rounded border border-border bg-transparent px-3 py-2.5 text-right dark:border-slate-700"
            />
          </div>

          <div className="flex items-center gap-3">
            <Clock3 className="text-muted-foreground" size={20} />
            <Input
              required
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="rounded border border-border bg-transparent px-3 py-2.5 dark:border-slate-700"
            />
            <span>تا</span>
            <Input
              required
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="rounded border border-border bg-transparent px-3 py-2.5 dark:border-slate-700"
            />
          </div>

          <div className="flex items-center gap-3">
            <MapPin className="text-muted-foreground" size={20} />
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="افزودن مکان"
              className="flex-1 rounded border border-border bg-transparent px-3 py-2.5 dark:border-slate-700"
            />
          </div>

          <Textarea
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="توضیحات رویداد"
            className="w-full resize-none rounded border border-border bg-transparent p-3 dark:border-slate-700"
          />

          <div>
            <p className="mb-2 text-sm text-muted-foreground">رنگ رویداد</p>
            <div className="flex gap-3">
              {EVENT_COLORS.map((color) => (
                <Button
                  variant="ghost"
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className={cn(
                    "h-7 w-7 rounded-full",
                    form.color === color && "ring-2 ring-offset-2",
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`رنگ ${color}`}
                />
              ))}
            </div>
          </div>

          {createdByOther && (
            <p className="rounded bg-muted/40 p-3 text-xs text-muted-foreground dark:bg-slate-900">
              این زمان توسط کاربر دیگری برنامه‌ریزی شده است.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
