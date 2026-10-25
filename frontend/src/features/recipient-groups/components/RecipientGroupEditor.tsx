"use client";

import { useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import UserDisplayName from "@/components/UserDisplayName";
import { Button } from "@/components/ui/button";
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

import {
  createRecipientGroup,
  deleteRecipientGroup,
  groupErrorMessage,
  updateRecipientGroup,
} from "../api";
import type { RecipientGroup, RecipientGroupPerson } from "../types";

function memberStatus(
  person: RecipientGroupPerson,
  picked: boolean,
  outside: boolean,
): string {
  if (outside) return "خارج از این فهرست";
  if (picked) return "عضو گروه";
  return person.job_title || person.department || person.username;
}

type RecipientGroupEditorProps = {
  open: boolean;
  people: RecipientGroupPerson[];
  group: RecipientGroup | null;
  isAdmin: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function RecipientGroupEditor({
  open,
  people,
  group,
  isAdmin,
  onOpenChange,
  onSaved,
}: RecipientGroupEditorProps) {
  const [name, setName] = useState(group?.name ?? "");
  const [memberIds, setMemberIds] = useState<number[]>(
    () => group?.members.map((member) => member.id) ?? [],
  );
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const peopleIds = useMemo(() => new Set(people.map((person) => person.id)), [people]);

  const candidates = useMemo(() => {
    const byId = new Map<number, RecipientGroupPerson>();
    for (const person of people) byId.set(person.id, person);
    for (const member of group?.members ?? []) {
      if (!byId.has(member.id)) byId.set(member.id, member);
    }
    return [...byId.values()];
  }, [group, people]);

  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("fa");
    if (!text) return candidates;
    return candidates.filter((person) =>
      [person.display_name, person.username, person.department, person.job_title]
        .join(" ")
        .toLocaleLowerCase("fa")
        .includes(text),
    );
  }, [candidates, query]);

  const toggleMember = (id: number) => {
    setMemberIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("نام گروه را وارد کنید.");
      return;
    }
    if (memberIds.length === 0) {
      setError("حداقل یک نفر را برای گروه انتخاب کنید.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input = { name: trimmed, member_ids: memberIds };
      if (group) await updateRecipientGroup(group.id, input);
      else await createRecipientGroup(input);
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(groupErrorMessage(err, "ذخیره گروه با مشکل مواجه شد."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!group) return;
    setSaving(true);
    setError("");
    try {
      await deleteRecipientGroup(group.id);
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(groupErrorMessage(err, "حذف گروه با مشکل مواجه شد."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-right sm:max-w-lg">
        <DialogHeader className="ps-8 text-right sm:text-right">
          <DialogTitle>
            {group
              ? group.is_shared
                ? "ویرایش گروه همگانی"
                : "ویرایش گروه"
              : isAdmin
                ? "گروه همگانی"
                : "گروه جدید"}
          </DialogTitle>
          <DialogDescription>
            {group?.is_shared || (!group && isAdmin)
              ? "این گروه برای همه کاربران قابل استفاده است و فقط مدیر می‌تواند آن را تغییر دهد."
              : "مثلاً «مدیران». بعداً با یک کلیک همه اعضای گروه انتخاب می‌شوند."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="recipient-group-name">نام گروه</Label>
            <Input
              id="recipient-group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="مدیران"
              className="rounded-xl"
            />
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجوی عضو..."
            className="rounded-xl"
          />
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
            {visible.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                کاربری برای افزودن پیدا نشد.
              </p>
            ) : (
              visible.map((person) => {
                const picked = memberIds.includes(person.id);
                const outside = !peopleIds.has(person.id);
                return (
                  <Button
                    key={person.id}
                    type="button"
                    variant="ghost"
                    onClick={() => toggleMember(person.id)}
                    className={`flex h-auto w-full items-center justify-between rounded-xl px-3 py-2 text-right text-sm ${
                      picked ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <span className="font-medium">
                      <UserDisplayName user={person} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {memberStatus(person, picked, outside)}
                    </span>
                  </Button>
                );
              })
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {memberIds.length.toLocaleString("fa-IR")} نفر انتخاب شده
          </p>
          {error && (
            <p role="alert" className="text-sm font-semibold text-primary">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          {group && confirmDelete ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">این گروه حذف شود؟</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setConfirmDelete(false)}
                >
                  انصراف
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={saving}
                  onClick={() => void remove()}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  حذف
                </Button>
              </div>
            </div>
          ) : (
            <>
              {group ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  disabled={saving}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  حذف گروه
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => onOpenChange(false)}
                >
                  انصراف
                </Button>
                <Button type="button" disabled={saving} onClick={() => void save()}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  ذخیره گروه
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
