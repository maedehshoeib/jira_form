import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { API_BASE, FormTemplate } from "../../config/portal";
import FormFieldRenderer from "./FormFieldRenderer";

import { Button } from "../ui/button";

export default function DynamicForm({ form }: { form: FormTemplate }) {
  const [searchParams] = useSearchParams();
  const departmentId = searchParams.get("department") || form.department_id || "";
  const sectionId = searchParams.get("section") || form.section_id || "";

  const initialValues = useMemo(() => {
    const obj: Record<string, unknown> = {};
    form.fields.forEach((field) => {
      obj[field.name] = field.type === "file" ? null : "";
    });
    return obj;
  }, [form]);

  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);
  const isPerformanceReport = form.id === "performance-report-form";

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const completedFields = Object.values(values).filter(
    (v) => v !== "" && v !== null && v !== undefined
  ).length;

  const progress =
    form.fields.length === 0 ? 0 : (completedFields / form.fields.length) * 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDone(false);

    const fd = new FormData();
    fd.append("form_id", form.id);
    fd.append("department_id", departmentId);
    fd.append("section_id", sectionId);

    Object.entries(values).forEach(([key, val]) => {
      if (val instanceof File) {
        fd.append(key, val);
      } else if (val !== null && val !== undefined) {
        fd.append(key, String(val));
      }
    });

    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(`${API_BASE}/submissions`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof data.report_id === "number") {
          setReportId(data.report_id);
        }
        setDone(true);
      }
    } finally {
      setLoading(false);
    }
  };

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

      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        {form.fields.map((field) => (
          <div key={field.name} className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              {field.label}
              {field.required && (
                <span className="mr-1 text-red-500">*</span>
              )}
            </label>

            <FormFieldRenderer
              field={field}
              value={values[field.name]}
              onChange={handleChange}
            />
          </div>
        ))}

        <div className="md:col-span-2">
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-red-600 text-base hover:bg-red-700"
          >
            {loading ? "در حال ثبت..." : "ثبت درخواست"}
          </Button>
        </div>
      </form>
    </div>
  );
}
