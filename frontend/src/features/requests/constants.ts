import type { StatusTab, WorkflowStatus } from "./types";

export const INTERNAL_LETTERS_FILTER = "internal-letters";
export const INTERNAL_LETTERS_TITLE = "نامه‌های درون‌سازمانی";

export const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "همه" },
  { id: "unseen", label: "دیده‌نشده" },
  { id: "seen", label: "دیده‌شده" },
  { id: "referred", label: "ارجاع‌شده" },
  { id: "in_progress", label: "در حال انجام" },
  { id: "completed", label: "انجام‌شده" },
  { id: "rejected", label: "رد‌شده" },
];

export const WORKFLOW_STATUS_META: Record<
  WorkflowStatus,
  {
    label: string;
    description: string;
    badgeClass: string;
    activeTabClass: string;
    barClass: string;
  }
> = {
  unseen: {
    label: "دیده‌نشده",
    description: "درخواست ثبت شده و هنوز توسط مسئول مربوطه باز نشده است.",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
    activeTabClass: "bg-amber-600 text-white shadow-amber-600/20 hover:bg-amber-700 hover:text-white",
    barClass: "bg-amber-500",
  },
  seen: {
    label: "دیده‌شده",
    description: "مسئول مربوطه درخواست را مشاهده کرده است.",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
    activeTabClass: "bg-sky-600 text-white shadow-sky-600/20 hover:bg-sky-700 hover:text-white",
    barClass: "bg-sky-500",
  },
  referred: {
    label: "ارجاع‌شده",
    description: "درخواست برای پیگیری به مسئول دیگری ارجاع شده است.",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
    activeTabClass: "bg-violet-600 text-white shadow-violet-600/20 hover:bg-violet-700 hover:text-white",
    barClass: "bg-violet-500",
  },
  in_progress: {
    label: "در حال انجام",
    description: "رسیدگی به درخواست آغاز شده و در حال پیشرفت است.",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
    activeTabClass: "bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-700 hover:text-white",
    barClass: "bg-blue-600",
  },
  completed: {
    label: "انجام‌شده",
    description: "رسیدگی به درخواست با موفقیت به پایان رسیده است.",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    activeTabClass: "bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700 hover:text-white",
    barClass: "bg-emerald-600",
  },
  rejected: {
    label: "رد‌شده",
    description: "درخواست توسط مسئول مربوطه رد شده است.",
    badgeClass: "border-primary/30 bg-primary/10 text-primary",
    activeTabClass: "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 hover:text-primary-foreground",
    barClass: "bg-primary/100",
  },
};
