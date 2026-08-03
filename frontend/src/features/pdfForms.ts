import client from "../api/client";
import { endpoints } from "../api/endpoints";

export type PdfLibraryCategory =
  | "forms"
  | "training"
  | "guidelines"
  | "documents";

export type PdfFormItem = {
  id: number;
  category: PdfLibraryCategory;
  title: string;
  description: string;
  file_name: string;
  file_size: number;
  created_at: string;
  updated_at?: string | null;
};

export type PdfLibraryConfig = {
  category: PdfLibraryCategory;
  title: string;
  singular: string;
  description: string;
  searchPlaceholder: string;
  addLabel: string;
  emptyLabel: string;
  notFoundLabel: string;
  loadingLabel: string;
  defaultItemDescription: string;
  accent: {
    iconBg: string;
    iconText: string;
    button: string;
    buttonHover: string;
    focusBorder: string;
    focusRing: string;
  };
};

export const PDF_LIBRARY_CONFIG: Record<PdfLibraryCategory, PdfLibraryConfig> = {
  forms: {
    category: "forms",
    title: "فرم‌های سازمانی",
    singular: "فرم",
    description: "فرم موردنظر را مشاهده کنید یا نسخه PDF آن را دریافت کنید.",
    searchPlaceholder: "جستجو در فرم‌ها",
    addLabel: "افزودن فرم",
    emptyLabel: "هنوز فرمی منتشر نشده است.",
    notFoundLabel: "فرمی با این عبارت پیدا نشد.",
    loadingLabel: "در حال دریافت فرم‌ها...",
    defaultItemDescription: "فرم آماده مشاهده و دریافت است.",
    accent: {
      iconBg: "bg-red-50",
      iconText: "text-red-600",
      button: "bg-red-600",
      buttonHover: "hover:bg-red-700",
      focusBorder: "focus:border-red-300",
      focusRing: "focus:ring-red-50",
    },
  },
  training: {
    category: "training",
    title: "آموزش",
    singular: "آموزش",
    description: "محتوای آموزشی را مشاهده کنید یا نسخه PDF آن را دریافت کنید.",
    searchPlaceholder: "جستجو در آموزش‌ها",
    addLabel: "افزودن آموزش",
    emptyLabel: "هنوز محتوای آموزشی منتشر نشده است.",
    notFoundLabel: "آموزشی با این عبارت پیدا نشد.",
    loadingLabel: "در حال دریافت آموزش‌ها...",
    defaultItemDescription: "محتوای آموزشی آماده مشاهده و دریافت است.",
    accent: {
      iconBg: "bg-blue-50",
      iconText: "text-blue-600",
      button: "bg-blue-600",
      buttonHover: "hover:bg-blue-700",
      focusBorder: "focus:border-blue-300",
      focusRing: "focus:ring-blue-50",
    },
  },
  guidelines: {
    category: "guidelines",
    title: "دستورالعمل",
    singular: "دستورالعمل",
    description: "آیین‌نامه‌ها و دستورالعمل‌ها را مشاهده یا دانلود کنید.",
    searchPlaceholder: "جستجو در دستورالعمل‌ها",
    addLabel: "افزودن دستورالعمل",
    emptyLabel: "هنوز دستورالعملی منتشر نشده است.",
    notFoundLabel: "دستورالعملی با این عبارت پیدا نشد.",
    loadingLabel: "در حال دریافت دستورالعمل‌ها...",
    defaultItemDescription: "دستورالعمل آماده مشاهده و دریافت است.",
    accent: {
      iconBg: "bg-cyan-50",
      iconText: "text-cyan-600",
      button: "bg-cyan-600",
      buttonHover: "hover:bg-cyan-700",
      focusBorder: "focus:border-cyan-300",
      focusRing: "focus:ring-cyan-50",
    },
  },
  documents: {
    category: "documents",
    title: "مستندات",
    singular: "مستند",
    description: "اسناد و مستندات را مشاهده کنید یا نسخه PDF آن را دریافت کنید.",
    searchPlaceholder: "جستجو در مستندات",
    addLabel: "افزودن مستند",
    emptyLabel: "هنوز مستندی منتشر نشده است.",
    notFoundLabel: "مستندی با این عبارت پیدا نشد.",
    loadingLabel: "در حال دریافت مستندات...",
    defaultItemDescription: "مستند آماده مشاهده و دریافت است.",
    accent: {
      iconBg: "bg-purple-50",
      iconText: "text-purple-600",
      button: "bg-purple-600",
      buttonHover: "hover:bg-purple-700",
      focusBorder: "focus:border-purple-300",
      focusRing: "focus:ring-purple-50",
    },
  },
};

export async function getPdfBlob(formId: number, category?: PdfLibraryCategory) {
  const { data } = await client.get<Blob>(
    `${endpoints.pdfForms}/${formId}/file`,
    {
      responseType: "blob",
      params: category ? { category } : undefined,
    },
  );
  return data;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
