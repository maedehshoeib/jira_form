import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  deleteLetterDraft,
  getLetterDraft,
  letterDraftEditHref,
  saveLetterDraft,
  sendLetterDraft,
  type LetterDraft,
} from "@/api/letterDrafts";

import type { LetterType } from "../screens/letterWorkflow";

type UseLetterDraftOptions = {
  letterType: LetterType;
  applyDraft: (draft: LetterDraft) => void;
  onError: (message: string) => void;
};

function apiDetail(err: unknown, fallback: string) {
  const detail = (err as { response?: { data?: { detail?: unknown } } } | null)?.response
    ?.data?.detail;
  return typeof detail === "string" && detail.trim() ? detail : fallback;
}

export function useLetterDraft({ letterType, applyDraft, onError }: UseLetterDraftOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftId, setDraftId] = useState<number | null>(null);
  const [storedAttachments, setStoredAttachments] = useState<string[]>([]);
  const [removedIndexes, setRemovedIndexes] = useState<Set<number>>(new Set());
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const draftIdRef = useRef<number | null>(null);

  const loadInto = (draft: LetterDraft) => {
    draftIdRef.current = draft.id;
    setDraftId(draft.id);
    setStoredAttachments(draft.attachment_names);
    setRemovedIndexes(new Set());
    setDraftSavedAt(draft.updated_at);
  };

  const rawDraftId = searchParams.get("draft");

  const replaceDraftParam = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("draft", value);
    else params.delete("draft");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  useEffect(() => {
    const id = Number(rawDraftId);
    if (!rawDraftId || !Number.isInteger(id) || id <= 0 || id === draftIdRef.current) return;
    let active = true;
    setDraftLoading(true);
    getLetterDraft(id)
      .then((draft) => {
        if (!active) return;
        if (draft.letter_type !== letterType) {
          router.replace(letterDraftEditHref(draft));
          return;
        }
        loadInto(draft);
        applyDraft(draft);
      })
      .catch(() => {
        if (active) onError("پیش‌نویس یافت نشد یا قابل بارگذاری نیست.");
      })
      .finally(() => {
        if (active) setDraftLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDraftId, letterType]);

  const withRemovals = (form: FormData) => {
    form.append("remove_attachments", JSON.stringify([...removedIndexes]));
    return form;
  };

  const toggleStoredAttachment = (index: number) => {
    setRemovedIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const saveDraft = async (form: FormData) => {
    setDraftSaving(true);
    try {
      const saved = await saveLetterDraft(withRemovals(form), draftId);
      loadInto(saved);
      if (rawDraftId !== String(saved.id)) replaceDraftParam(String(saved.id));
      return true;
    } catch (err) {
      onError(apiDetail(err, "ذخیره پیش‌نویس انجام نشد."));
      return false;
    } finally {
      setDraftSaving(false);
    }
  };

  const clearDraft = () => {
    draftIdRef.current = null;
    setDraftId(null);
    setStoredAttachments([]);
    setRemovedIndexes(new Set());
    setDraftSavedAt("");
    if (rawDraftId) replaceDraftParam(null);
  };

  const sendDraft = async (form: FormData) => {
    if (!draftId) throw new Error("پیش‌نویس انتخاب نشده است.");
    try {
      return await sendLetterDraft(draftId, withRemovals(form));
    } catch (err) {
      throw new Error(apiDetail(err, "ارسال نامه انجام نشد."));
    }
  };

  const discardDraft = async () => {
    if (!draftId) return false;
    try {
      await deleteLetterDraft(draftId);
      clearDraft();
      return true;
    } catch (err) {
      onError(apiDetail(err, "حذف پیش‌نویس انجام نشد."));
      return false;
    }
  };

  return {
    draftId,
    storedAttachments,
    removedIndexes,
    draftLoading,
    draftSaving,
    draftSavedAt,
    toggleStoredAttachment,
    saveDraft,
    sendDraft,
    discardDraft,
    clearDraft,
  };
}
