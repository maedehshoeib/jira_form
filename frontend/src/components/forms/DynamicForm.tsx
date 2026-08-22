import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { API_BASE, FormTemplate } from "../../config/portal";
import FormFieldRenderer from "./FormFieldRenderer";

import { Button } from "../ui/button";

const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024;
const SUBMISSION_TIMEOUT_MS = 90_000;

function createEmptyValues(form: FormTemplate): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  form.fields.forEach((field) => {
    if (field.type === "file") {
      obj[field.name] = null;
    } else if (field.type === "table") {
      obj[field.name] = field.default_rows?.map((row) => ({ ...row })) ?? [];
    } else {
      obj[field.name] = "";
    }
  });
  return obj;
}

function isFieldFilled(value: unknown): boolean {
  if (value === "" || value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    return value.some((row) =>
      Object.values(row).some((cell) => String(cell).trim() !== "")
    );
  }
  return true;
}

export default function DynamicForm({ form }: { form: FormTemplate }) {
  const [searchParams] = useSearchParams();
  const departmentId = searchParams.get("department") || form.department_id || "";
  const sectionId = searchParams.get("section") || form.section_id || "";

  const initialValues = useMemo(() => createEmptyValues(form), [form]);

  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [formKey, setFormKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reportId, setReportId] = useState<number | null>(null);
  const isSubmittingRef = useRef(false);
  const isPerformanceReport = form.id === "performance-report-form";

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const completedFields = Object.values(values).filter(isFieldFilled).length;

  const progress =
    form.fields.length === 0 ? 0 : (completedFields / form.fields.length) * 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    const oversizedFile = Object.values(values).find(
      (value): value is File =>
        value instanceof File && value.size > MAX_ATTACHMENT_SIZE,
    );
    if (oversizedFile) {
      setSubmitError(
        `حجم فایل «${oversizedFile.name}» بیشتر از ۱۵ مگابایت است.`,
      );
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setDone(false);
    setSubmitError("");

    const fd = new FormData();
    fd.append("form_id", form.id);
    fd.append("department_id", departmentId);
    fd.append("section_id", sectionId);

    Object.entries(values).forEach(([key, val]) => {
      if (val instanceof File) {
        fd.append(key, val);
      } else if (Array.isArray(val)) {
        fd.append(key, JSON.stringify(val));
      } else if (val !== null && val !== undefined) {
        fd.append(key, String(val));
      }
    });

    const token = localStorage.getItem("access_token");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      SUBMISSION_TIMEOUT_MS,
    );

    try {
      const res = await fetch(`${API_BASE}/submissions`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
        signal: controller.signal,
      });

      if (!res.ok) {
        let message = "ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.";
        if (res.status === 413) {
          message =
            "حجم فایل برای سرور بیش از حد مجاز است. حداکثر حجم پیوست ۱۵ مگابایت است.";
        } else {
          try {
            const body = (await res.json()) as { detail?: string };
            if (body.detail) message = body.detail;
          } catch {
            // Proxies can return an HTML error page; keep the useful fallback.
          }
        }
        throw new Error(message);
      }

      const data = await res.json();
      if (typeof data.report_id === "number") {
        setReportId(data.report_id);
      }
      setDone(true);
      setValues(createEmptyValues(form));
      setFormKey((key) => key + 1);
    } catch (error) {
      setSubmitError(
        error instanceof DOMException && error.name === "AbortError"
          ? "زمان ثبت درخواست بیش از حد طول کشید. اتصال سرور یا تنظیمات بارگذاری را بررسی کنید و دوباره تلاش کنید."
          : error instanceof Error
            ? error.message
            : "ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.",
      );
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  let lastSection = "";

  return (
    <div className="rounded-3xl border-0 bg-white p-8 shadow-xl">
      {done && (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
          {isPerformanceReport
            ? "گزارش با موفقیت ثبت شد و در بخش گزارشات قابل مشاهده است."
            : "درخواست با موفقیت ثبت شد."}
          {isPerformanceReport && (
            <div className="mt-3">
              <Link
                to="/reports/performance"
                className="font-semibold text-red-600 hover:text-red-700"
              >
                مشاهده گزارش ثبت‌شده
              </Link>
              {reportId !== null && (
                <span className="mr-2 text-sm text-slate-500">
                  (شناسه گزارش: {reportId})
                </span>
              )}
            </div>
          )}
          {!isPerformanceReport && (
            <div className="mt-3">
              <Link
                to="/my-requests"
                className="font-semibold text-red-600 hover:text-red-700"
              >
                مشاهده درخواست‌های من
              </Link>
            </div>
          )}
        </div>
      )}

      {submitError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {submitError}
        </div>
      )}

      <div className="mb-8">
        <div className="mb-2 flex justify-between">
          <span className="text-sm text-slate-600">پیشرفت تکمیل فرم</span>
          <span className="text-sm font-semibold text-red-600">
            {Math.round(progress)}%
          </span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-red-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <form key={formKey} onSubmit={handleSubmit} className="space-y-8">
        {form.fields.map((field) => {
          const showSection = field.section && field.section !== lastSection;
          if (field.section) lastSection = field.section;

          const isFullWidth =
            field.type === "textarea" || field.type === "table";

          return (
            <div key={field.name}>
              {showSection && (
                <h2 className="mb-4 border-r-4 border-red-600 pr-3 text-lg font-bold text-slate-800">
                  {field.section}
                </h2>
              )}

              <div
                className={
                  isFullWidth ? "flex flex-col gap-2" : "flex flex-col gap-2"
                }
              >
                {field.type !== "table" && (
                  <label className="text-sm font-semibold text-slate-700">
                    {field.label}
                    {field.required && (
                      <span className="mr-1 text-red-500">*</span>
                    )}
                  </label>
                )}

                <FormFieldRenderer
                  field={field}
                  value={values[field.name]}
                  onChange={handleChange}
                />
              </div>
            </div>
          );
        })}

        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-xl bg-red-600 text-base hover:bg-red-700"
        >
          {loading ? "در حال ثبت..." : "ثبت گزارش"}
        </Button>
      </form>
    </div>
  );
}
