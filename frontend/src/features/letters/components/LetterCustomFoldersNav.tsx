"use client";

import { useState } from "react";
import { Folder, FolderPlus, Loader2, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  createLetterFolder,
  customFolderKey,
  deleteLetterFolder,
  renameLetterFolder,
  type LetterFolder,
  type LetterFolderScope,
} from "../letterFolders";

type Props = {
  scope: LetterFolderScope;
  folders: LetterFolder[];
  activeFolder: string;
  workspaceOpen: boolean;
  onSelect: (folderKey: string) => void;
  onChanged: () => void;
  onError: (message: string) => void;
};

export function LetterCustomFoldersNav({
  scope,
  folders,
  activeFolder,
  workspaceOpen,
  onSelect,
  onChanged,
  onError,
}: Props) {
  const scoped = folders.filter((folder) => folder.scope === scope);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const create = async () => {
    const cleaned = name.trim();
    if (!cleaned) return;
    setSaving(true);
    onError("");
    try {
      const folder = await createLetterFolder(cleaned, scope);
      setName("");
      setCreating(false);
      onChanged();
      onSelect(customFolderKey(folder.id));
    } catch {
      onError("ایجاد پوشه انجام نشد.");
    } finally {
      setSaving(false);
    }
  };

  const rename = async (folderId: number) => {
    const cleaned = renameValue.trim();
    if (!cleaned) return;
    setSaving(true);
    onError("");
    try {
      await renameLetterFolder(folderId, cleaned);
      setRenamingId(null);
      onChanged();
    } catch {
      onError("تغییر نام پوشه انجام نشد.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (folder: LetterFolder) => {
    if (!window.confirm(`پوشه «${folder.name}» حذف شود؟ نامه‌ها حذف نمی‌شوند.`)) {
      return;
    }
    setSaving(true);
    onError("");
    try {
      await deleteLetterFolder(folder.id);
      if (activeFolder === customFolderKey(folder.id)) {
        onSelect(scope === "received" ? "inbox" : "sent");
      }
      onChanged();
    } catch {
      onError("حذف پوشه انجام نشد.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between px-2">
        <p className="text-[11px] font-bold text-muted-foreground">پوشه‌های من</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] text-muted-foreground"
          onClick={() => setCreating((prev) => !prev)}
        >
          <FolderPlus size={12} className="ml-1" />
          جدید
        </Button>
      </div>

      {creating ? (
        <div className="flex gap-1 px-1">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="نام پوشه"
            maxLength={80}
            className="h-8 rounded-lg text-xs"
          />
          <Button
            type="button"
            size="sm"
            disabled={saving || !name.trim()}
            onClick={() => void create()}
            className="h-8 shrink-0 rounded-lg px-2 text-xs"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ثبت"}
          </Button>
        </div>
      ) : null}

      {scoped.map((folder) => {
        const key = customFolderKey(folder.id);
        const active = !workspaceOpen && activeFolder === key;
        if (renamingId === folder.id) {
          return (
            <div key={folder.id} className="flex gap-1 px-1">
              <Input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                maxLength={80}
                className="h-8 rounded-lg text-xs"
              />
              <Button
                type="button"
                size="sm"
                disabled={saving || !renameValue.trim()}
                onClick={() => void rename(folder.id)}
                className="h-8 shrink-0 rounded-lg px-2 text-xs"
              >
                ذخیره
              </Button>
            </div>
          );
        }
        return (
          <div key={folder.id} className="group flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSelect(key)}
              className={cn(
                "h-9 min-w-0 flex-1 justify-between rounded-xl px-3 text-sm font-semibold",
                active
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Folder size={14} className="shrink-0" />
                <span className="truncate">{folder.name}</span>
              </span>
              <span
                className={cn(
                  "min-w-5 rounded-full px-1 text-center text-[11px] font-extrabold",
                  active ? "bg-white/20" : "bg-muted text-muted-foreground",
                )}
              >
                {folder.item_count.toLocaleString("fa-IR")}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground opacity-70 hover:opacity-100"
              onClick={() => {
                setRenamingId(folder.id);
                setRenameValue(folder.name);
              }}
              aria-label="تغییر نام پوشه"
            >
              <Pencil size={12} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground opacity-70 hover:text-primary hover:opacity-100"
              onClick={() => void remove(folder)}
              aria-label="حذف پوشه"
            >
              <Trash2 size={12} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
