import type { FormTemplate } from "@/config/portal";

export type CardKind = "group" | "form" | "document";

export type CardFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "date"
  | "time"
  | "select"
  | "file"
  | "table";

export type PortalCardSummary = {
  id: number;
  parent_id: number | null;
  kind: CardKind;
  title: string;
  description: string;
  logo_url: string | null;
  sort_order: number;
  is_published: boolean;
  child_count: number;
};

export type PortalCardFile = {
  id: number;
  title: string;
  file_name: string;
  file_size: number;
  is_pdf: boolean;
};

export type PortalCardBreadcrumb = { id: number; title: string };

export type PortalCardDetail = PortalCardSummary & {
  breadcrumbs: PortalCardBreadcrumb[];
  children: PortalCardSummary[];
  form: FormTemplate | null;
  content: string;
  files: PortalCardFile[];
  updated_at: string | null;
};

export type CardOption = { label: string; value: string };
export type CardColumn = { key: string; title: string };

export type CardFormField = {
  name: string;
  label: string;
  type: CardFieldType;
  required: boolean;
  placeholder: string | null;
  options: CardOption[];
  columns: CardColumn[];
  initial_rows: number;
  visible_when_field: string | null;
  visible_when_value: string | null;
};

export type CardFormSection = {
  id: string;
  title: string;
  fields: CardFormField[];
};

export type CardFormSchema = { sections: CardFormSection[] };

export type PortalCardAdminDetail = PortalCardDetail & {
  form_schema: CardFormSchema | null;
};

export type CardBasics = {
  title: string;
  description: string;
  is_published: boolean;
};

export type CreateCardInput = CardBasics & {
  kind: CardKind;
  parent_id: number | null;
  logo: File | null;
};

export type UpdateCardInput = CardBasics & {
  logo: File | null;
  remove_logo: boolean;
};

export const CARD_KIND_LABELS: Record<CardKind, string> = {
  group: "کارت گروهی",
  form: "فرم",
  document: "مستند",
};

export const CARD_KIND_HINTS: Record<CardKind, string> = {
  group: "شامل کارت‌های دیگر (فرم، مستند یا زیرکارت)",
  form: "فرم با بخش‌ها و فیلدهای دلخواه",
  document: "متن توضیحی و فایل‌های قابل دانلود",
};

export const FIELD_TYPE_LABELS: Record<CardFieldType, string> = {
  text: "متن کوتاه",
  textarea: "متن بلند",
  number: "عدد",
  email: "ایمیل",
  date: "تاریخ",
  time: "ساعت",
  select: "لیست انتخابی",
  file: "فایل پیوست",
  table: "جدول",
};
