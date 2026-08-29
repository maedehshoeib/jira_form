import type { StatusTab } from "./types";

export const REFERRAL_NOTE_MAX_LENGTH = 512;

export const INTERNAL_LETTERS_FILTER = "internal-letters";
export const INTERNAL_LETTERS_TITLE = "نامه‌های درون‌سازمانی";

export const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "pending", label: "اقدام نشده" },
  { id: "in_progress", label: "در حال انجام" },
  { id: "rejected", label: "رد شده" },
  { id: "approved", label: "انجام شده" },
  { id: "referred", label: "ارجاع شده" },
];
