import client from "@/api/client";
import { endpoints } from "@/api/endpoints";

export type LetterDraftType = "internal" | "external";

export type LetterDraftSummary = {
  id: number;
  letter_type: LetterDraftType;
  subject: string;
  recipient_count: number;
  attachment_count: number;
  updated_at: string;
};

export type LetterDraft = {
  id: number;
  letter_type: LetterDraftType;
  subject: string;
  description: string;
  letter_number: string;
  needs_reply: string;
  needs_action: string;
  due_date: string;
  sender: string;
  sender_detail: string;
  recipient_ids: number[];
  cc_recipient_ids: number[];
  recipient_comments: Record<string, string>;
  attachment_names: string[];
  created_at: string;
  updated_at: string;
};

export type LetterDraftSendResult = {
  message: string;
  system_letter_number: string;
  count: number;
  ids: number[];
};

const UPLOAD_TIMEOUT_MS = 120000;

export function letterDraftEditHref(draft: Pick<LetterDraftSummary, "id" | "letter_type">) {
  return `/my-letters?compose=${draft.letter_type}&draft=${draft.id}`;
}

export async function listLetterDrafts() {
  const { data } = await client.get<LetterDraftSummary[]>(endpoints.managementLetterDrafts);
  return data;
}

export async function getLetterDraft(draftId: number) {
  const { data } = await client.get<LetterDraft>(endpoints.managementLetterDraft(draftId));
  return data;
}

export async function saveLetterDraft(form: FormData, draftId?: number | null) {
  const { data } = draftId
    ? await client.put<LetterDraft>(endpoints.managementLetterDraft(draftId), form, {
        timeout: UPLOAD_TIMEOUT_MS,
      })
    : await client.post<LetterDraft>(endpoints.managementLetterDrafts, form, {
        timeout: UPLOAD_TIMEOUT_MS,
      });
  return data;
}

export async function sendLetterDraft(draftId: number, form: FormData) {
  const { data } = await client.post<LetterDraftSendResult>(
    endpoints.managementLetterDraftSend(draftId),
    form,
    { timeout: UPLOAD_TIMEOUT_MS },
  );
  return data;
}

export async function deleteLetterDraft(draftId: number) {
  await client.delete(endpoints.managementLetterDraft(draftId));
}
