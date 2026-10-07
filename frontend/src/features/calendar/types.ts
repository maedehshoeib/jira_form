export type CalendarEvent = {
  id: number;
  title: string;
  description: string;
  location: string;
  jalali_date: string;
  start_time: string;
  end_time: string;
  color: string;
  user_id: number;
  user_name: string;
  created_by_id: number;
  created_by_name: string;
};

export type CalendarUser = {
  id: number;
  display_name: string;
  username: string;
};

export type EventForm = {
  title: string;
  description: string;
  location: string;
  jalali_date: string;
  start_time: string;
  end_time: string;
  color: string;
  user_ids: number[];
};

export type ViewMode = "day" | "week" | "month" | "year";

export const WEEK_DAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
] as const;

export const EVENT_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#059669",
  "#d97706",
] as const;
