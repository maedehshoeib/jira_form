import {
  AlarmClock,
  CheckCircle2,
  Clock,
  EyeOff,
  Info,
  Send,
} from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { getTodayPersian, isPersianDateAfter } from "@/lib/persianDate";
import { LETTER_NO_ACTION_VALUE } from "@/features/tasks";
import type { LetterType } from "@/features/management";

export type SentRecipient = {
  user_id: number | null;
  display_name: string;
  status: string;
  status_updated_at: string | null;
  submission_id: number;
  referred_to?: string | null;
  comment?: string;
  delivery_type?: "direct" | "cc";
  is_read?: boolean;
};

export type SentLetter = {
  batch_id: string;
  subject: string;
  description: string;
  letter_number?: string;
  system_letter_number?: string;
  letter_type: LetterType;
  needs_reply?: string;
  needs_action?: string;
  due_date?: string;
  sender?: string;
  sender_detail?: string;
  attachment_name: string | null;
  attachment_names?: string[];
  created_at: string;
  sent_by: string;
  recipients: SentRecipient[];
};

export type SentFolder =
  | "sent"
  | "sent_unread"
  | "sent_pending"
  | "sent_overdue"
  | "sent_done"
  | "sent_inform";

export const SENT_FOLDERS: { id: SentFolder; label: string; icon: typeof Send }[] = [
  { id: "sent", label: "همه ارسالی‌ها", icon: Send },
  { id: "sent_unread", label: "خوانده‌نشده", icon: EyeOff },
  { id: "sent_pending", label: "در انتظار اقدام", icon: Clock },
  { id: "sent_overdue", label: "مهلت گذشته", icon: AlarmClock },
  { id: "sent_done", label: "انجام‌شده", icon: CheckCircle2 },
  { id: "sent_inform", label: "جهت اطلاع", icon: Info },
];

const FINAL_STATUSES = new Set(["approved", "rejected"]);

export function isSentFolder(folder: string): folder is SentFolder {
  return SENT_FOLDERS.some((item) => item.id === folder);
}

function directRecipients(letter: SentLetter) {
  return letter.recipients.filter((row) => row.delivery_type !== "cc");
}

function isInformOnly(letter: SentLetter) {
  return letter.needs_action === LETTER_NO_ACTION_VALUE;
}

export function sentHasUnread(letter: SentLetter) {
  return letter.recipients.some((row) => !row.is_read);
}

export function sentIsPending(letter: SentLetter) {
  if (isInformOnly(letter)) return false;
  return directRecipients(letter).some((row) => !FINAL_STATUSES.has(row.status));
}

export function sentIsOverdue(letter: SentLetter) {
  if (!letter.due_date || !sentIsPending(letter)) return false;
  return isPersianDateAfter(getTodayPersian(), letter.due_date);
}

export function sentIsDone(letter: SentLetter) {
  if (isInformOnly(letter)) return false;
  const direct = directRecipients(letter);
  return direct.length > 0 && direct.every((row) => FINAL_STATUSES.has(row.status));
}

export function matchesSentFolder(letter: SentLetter, folder: SentFolder) {
  if (folder === "sent_unread") return sentHasUnread(letter);
  if (folder === "sent_pending") return sentIsPending(letter);
  if (folder === "sent_overdue") return sentIsOverdue(letter);
  if (folder === "sent_done") return sentIsDone(letter);
  if (folder === "sent_inform") return isInformOnly(letter);
  return true;
}

export function sentFolderCounts(letters: SentLetter[]) {
  const counts = Object.fromEntries(SENT_FOLDERS.map((item) => [item.id, 0])) as Record<
    SentFolder,
    number
  >;
  letters.forEach((letter) => {
    SENT_FOLDERS.forEach((item) => {
      if (matchesSentFolder(letter, item.id)) counts[item.id] += 1;
    });
  });
  return counts;
}

export function sentReadSummary(letter: SentLetter) {
  const read = letter.recipients.filter((row) => row.is_read).length;
  return { read, total: letter.recipients.length };
}

export function sentStatusLabel(letter: SentLetter) {
  if (isInformOnly(letter)) return "جهت اطلاع";
  if (sentIsOverdue(letter)) return "مهلت گذشته";
  if (sentIsDone(letter)) return "انجام‌شده";
  return "در انتظار اقدام";
}

export function sentAttachmentNames(letter: SentLetter) {
  if (letter.attachment_names?.length) return letter.attachment_names;
  return letter.attachment_name ? [letter.attachment_name] : [];
}

export async function listSentLetters(letterTypes: LetterType[]) {
  const batches = await Promise.all(
    letterTypes.map((letterType) =>
      client
        .get<SentLetter[]>(endpoints.managementLetterReport, {
          params: { letter_type: letterType, mine: true },
        })
        .then(({ data }) => data.map((item) => ({ ...item, letter_type: letterType })))
        .catch(() => [] as SentLetter[]),
    ),
  );
  return batches.flat().sort((a, b) => b.created_at.localeCompare(a.created_at));
}
