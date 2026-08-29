import { formatPersianDateTime, getTodayPersian } from "@/lib/persianDate";

import type { ChatUser, Conversation } from "./api/chat-service";

export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "؟"
  );
}

export function formatTime(value: string) {
  const formatted = formatPersianDateTime(value);
  const parts = formatted.split(" ");
  return parts[1] || formatted;
}

export function formatListTime(value: string) {
  const formatted = formatPersianDateTime(value);
  const datePart = formatted.split(" ")[0] || formatted;
  if (datePart === getTodayPersian()) return formatTime(value);
  const segments = datePart.split("/");
  if (segments.length === 3) return `${segments[1]}/${segments[2]}`;
  return datePart;
}

export function fileSize(value: number) {
  if (value < 1024) return `${value.toLocaleString("fa-IR")} بایت`;
  if (value < 1024 * 1024)
    return `${Math.ceil(value / 1024).toLocaleString("fa-IR")} کیلوبایت`;
  return `${(value / 1024 / 1024).toLocaleString("fa-IR", {
    maximumFractionDigits: 1,
  })} مگابایت`;
}

export function errorText(error: unknown) {
  const candidate = error as {
    response?: { data?: { detail?: string | { msg?: string }[] } };
  };
  const detail = candidate.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail[0]?.msg || "درخواست نامعتبر است";
  return "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";
}

export function conversationPeer(
  conversation: Conversation,
  currentUserId?: number
): ChatUser | undefined {
  if (conversation.kind !== "direct") return undefined;
  return conversation.members.find((member) => member.id !== currentUserId);
}
