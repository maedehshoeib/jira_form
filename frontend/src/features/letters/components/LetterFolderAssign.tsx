"use client";

import { useMemo, useState } from "react";
import { FolderPlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  addLetterToFolder,
  type LetterFolder,
  type LetterFolderScope,
} from "../letterFolders";

type Props = {
  scope: LetterFolderScope;
  folders: LetterFolder[];
  submissionId?: number;
  batchId?: string;
  onChanged: () => void;
  onError: (message: string) => void;
};

export function LetterFolderAssign({
  scope,
  folders,
  submissionId,
  batchId,
  onChanged,
  onError,
}: Props) {
  const scoped = useMemo(
    () => folders.filter((folder) => folder.scope === scope),
    [folders, scope],
  );
  const [folderId, setFolderId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  if (scoped.length === 0) return null;

  const alreadyIn = useMemo(() => {
    return new Set(
      scoped
        .filter((folder) =>
          scope === "received"
            ? submissionId != null && folder.submission_ids.includes(submissionId)
            : Boolean(batchId && folder.batch_ids.includes(batchId)),
        )
        .map((folder) => folder.id),
    );
  }, [scoped, scope, submissionId, batchId]);

  const assign = async () => {
    const id = Number(folderId);
    if (!Number.isFinite(id) || alreadyIn.has(id)) return;
    setLoading(true);
    onError("");
    try {
      await addLetterToFolder(
        id,
        scope === "received"
          ? { submission_id: submissionId }
          : { batch_id: batchId },
      );
      setFolderId("");
      onChanged();
    } catch {
      onError("افزودن نامه به پوشه انجام نشد.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
      <FolderPlus size={14} className="shrink-0 text-muted-foreground" />
      <Select value={folderId || undefined} onValueChange={setFolderId}>
        <SelectTrigger className="h-8 w-44 rounded-lg bg-card text-xs">
          <SelectValue placeholder="افزودن به پوشه…" />
        </SelectTrigger>
        <SelectContent>
          {scoped.map((folder) => (
            <SelectItem
              key={folder.id}
              value={String(folder.id)}
              disabled={alreadyIn.has(folder.id)}
            >
              {folder.name}
              {alreadyIn.has(folder.id) ? " (قبلاً افزوده شده)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!folderId || loading}
        onClick={() => void assign()}
        className="h-8 gap-1.5 rounded-lg px-3 text-xs"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        افزودن
      </Button>
    </div>
  );
}
