import { Label } from "@/components/ui/label";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import AppShell from "../../components/layout/AppShell";
import FormFieldRenderer from "../../components/forms/FormFieldRenderer";
import { API_BASE, FormField, FormTemplate } from "../../config/portal";
import {
  addOneYearAndOneDay,
  getTodayPersian,
  isPersianDateAfter,
  normalizePersianDate,
} from "../../lib/persianDate";
import { Button } from "../../components/ui/button";

const CONTRACT_FORM: FormTemplate = {
  id: "contract-report-form",
  title: "ثبت قراردادها",
  fields: [
    {
      name: "start_date",
      label: "تاریخ شروع",
      type: "date",
      section: "تاریخ ثبت قرارداد",
      required: true,
      maxDate: "today",
    },
    {
      name: "end_date",
      label: "تاریخ پایان",
      type: "date",
      section: "تاریخ ثبت قرارداد",
      required: true,
    },
    {
      name: "subject",
      label: "موضوع قرارداد",
      type: "text",
      required: true,
    },
    {
      name: "contract_party",
      label: "طرف قرارداد",
      type: "text",
      required: true,
    },
    {
      name: "contract_type",
      label: "نوع قرارداد",
      type: "select",
      required: true,
      options: [
        { label: "کسب و کار", value: "business" },
        { label: "ستادی", value: "staff" },
      ],
    },
    {
      name: "contract_number",
      label: "شماره قرارداد",
      type: "text",
      required: true,
    },
    {
      name: "attachment",
      label: "پیوست",
      type: "file",
      required: false,
    },
  ],
};

function createEmptyValues(fields: FormField[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  fields.forEach((field) => {
    obj[field.name] = field.type === "file" ? null : "";
  });
  return obj;
}

function isFieldFilled(value: unknown): boolean {
  if (value === "" || value === null || value === undefined) return false;
  return true;
}

export default function ContractReportForm() {
  const initialValues = useMemo(
    () => createEmptyValues(CONTRACT_FORM.fields),
    []
  );

  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [formKey, setFormKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [rowNumber, setRowNumber] = useState<number | null>(null);
  const isSubmittingRef = useRef(false);

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => {
      const normalizedValue =
        name === "start_date" || name === "end_date"
          ? normalizePersianDate(value)
          : value;
      const next = { ...prev, [name]: normalizedValue };

      if (name === "start_date" && normalizedValue) {
        next.end_date = addOneYearAndOneDay(String(normalizedValue));
      }

      return next;
    });
  };

  const completedFields = Object.entries(values).filter(([key, val]) => {
    const field = CONTRACT_FORM.fields.find((f) => f.name === key);
    if (field?.required === false) return false;
    return isFieldFilled(val);
  }).length;

  const requiredCount = CONTRACT_FORM.fields.filter((f) => f.required !== false)
    .length;

  const progress =
    requiredCount === 0 ? 0 : (completedFields / requiredCount) * 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    const startDate = String(values.start_date ?? "").trim();
    if (startDate && isPersianDateAfter(startDate, getTodayPersian())) {
      setError("تاریخ شروع نمی‌تواند بعد از امروز باشد.");
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setDone(false);
    setError("");

    const fd = new FormData();
    Object.entries(values).forEach(([key, val]) => {
      if (val instanceof File) {
        fd.append(key, val);
      } else if (val !== null && val !== undefined) {
        fd.append(key, String(val));
      }
    });

    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(`${API_BASE}/contracts`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      if (res.ok) {
        const data = await res.json();
        setRowNumber(data.row_number ?? null);
        setDone(true);
        setValues(createEmptyValues(CONTRACT_FORM.fields));
        setFormKey((key) => key + 1);
      } else {
        const data = await res.json().catch(() => null);
        setError(
          typeof data?.detail === "string"
            ? data.detail
            : "خطا در ثبت قرارداد. لطفاً دوباره تلاش کنید."
        );
      }
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <Link
          to="/contracts-archive"
          className="font-semibold text-primary hover:text-primary"
        >
          بازگشت
        </Link>

        <h1 className="mt-8 text-3xl font-bold">ثبت قراردادها</h1>
        <p className="mt-2 text-muted-foreground">
          اطلاعات قرارداد را وارد کنید
        </p>

        <div className="mt-8 rounded-3xl border-0 bg-card p-8 shadow-xl">
          {error && (
            <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-primary">
              {error}
            </div>
          )}

          {done && (
            <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
              قرارداد با موفقیت ثبت شد.
              {rowNumber !== null && (
                <span className="mr-2 text-sm text-muted-foreground">
                  (ردیف: {rowNumber})
                </span>
              )}
              <div className="mt-3">
                <Link
                  to="/contracts-archive/list"
                  className="font-semibold text-primary hover:text-primary"
                >
                  مشاهده فهرست قراردادها
                </Link>
              </div>
            </div>
          )}

          <div className="mb-8">
            <div className="mb-2 flex justify-between">
              <span className="text-sm text-muted-foreground">پیشرفت تکمیل فرم</span>
              <span className="text-sm font-semibold text-primary">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <form key={formKey} onSubmit={handleSubmit} className="space-y-8">
            {CONTRACT_FORM.fields.map((field, index, fields) => {
              const showSection =
                field.section &&
                field.section !== fields[index - 1]?.section;

              return (
              <div key={field.name} className="flex flex-col gap-2">
                {showSection && (
                  <h2 className="mb-2 border-r-4 border-red-600 pr-3 text-lg font-bold text-foreground">
                    {field.section}
                  </h2>
                )}
                {field.type !== "table" && (
                  <Label className="text-sm font-semibold text-foreground">
                    {field.label}
                    {field.required !== false && (
                      <span className="mr-1 text-red-500">*</span>
                    )}
                  </Label>
                )}
                <FormFieldRenderer
                  field={field}
                  value={values[field.name]}
                  onChange={handleChange}
                  dateMin={
                    field.name === "end_date"
                      ? String(values.start_date ?? "")
                      : undefined
                  }
                  inputKey={
                    field.name === "end_date"
                      ? `end-${String(values.start_date ?? "")}-${String(values.end_date ?? "")}`
                      : field.name
                  }
                />
              </div>
            );
            })}

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-primary text-base hover:bg-primary/90"
            >
              {loading ? "در حال ثبت..." : "ثبت قرارداد"}
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
