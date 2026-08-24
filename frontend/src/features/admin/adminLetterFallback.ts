import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import type { ChartItem, LettersAnalytics } from "./analytics";

type LegacyLetter = {
  id: number;
  form_id: string;
  department_title: string;
  section_title: string;
  subject: string;
  status: string;
  submitted_by: string;
  created_at: string;
  referrals?: Array<{ to_user_name: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "اقدام‌نشده",
  in_progress: "در حال انجام",
  approved: "انجام‌شده",
  rejected: "ردشده",
};

const latinDigits = (value: string) =>
  value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

function jalaliDay(value: string): string {
  if (/^1[34]\d{2}[/-]\d{2}[/-]\d{2}/.test(latinDigits(value))) {
    return latinDigits(value).slice(0, 10).replaceAll("-", "/");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => latinDigits(parts.find((item) => item.type === type)?.value || "");
  return `${part("year")}/${part("month")}/${part("day")}`;
}

function chart(values: string[], limit?: number): ChartItem[] {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const result = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, "fa"));
  return limit ? result.slice(0, limit) : result;
}

function letterType(row: LegacyLetter) {
  return `${row.department_title} ${row.section_title}`.includes("درون")
    ? "درون‌سازمانی"
    : "برون‌سازمانی";
}

export async function fetchAdminLetterFallback(startDate: string, endDate: string): Promise<LettersAnalytics> {
  const { data } = await client.get<LegacyLetter[]>(endpoints.submissions, {
    params: { form_id: "management-letter-form", limit: 500 },
  });
  const copies = (Array.isArray(data) ? data : []).filter((row) => {
    const day = jalaliDay(row.created_at);
    return !day || (day >= startDate && day <= endDate);
  });
  const batches = new Map<string, LegacyLetter>();
  copies.forEach((row) => batches.set(`${row.subject}|${row.created_at.slice(0, 16)}`, row));
  const open = copies.filter((row) => row.status === "submitted" || row.status === "in_progress");

  return {
    total_letters: batches.size,
    recipient_copies: copies.length,
    open_copies: open.length,
    completed_copies: copies.filter((row) => row.status === "approved").length,
    by_type: chart([...batches.values()].map(letterType)),
    by_status: chart(copies.map((row) => STATUS_LABELS[row.status] || row.status || "نامشخص")),
    top_senders: chart([...batches.values()].map((row) => row.submitted_by), 10),
    top_recipients: chart(
      copies.map((row) => row.referrals?.[0]?.to_user_name || "گیرنده نامشخص"),
      10,
    ),
  };
}
