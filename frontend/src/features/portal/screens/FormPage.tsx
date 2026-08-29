import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

import {
  ChevronLeft,
  Building2,
  FileText,
  CheckCircle2,
} from 'lucide-react';

import AppShell from '@/components/layout/AppShell';
import { API_BASE, FormTemplate } from '@/config/portal';
import DynamicForm from '@/components/forms/DynamicForm';

export default function FormPage() {
  const { formId } = useParams<{ formId: string }>();
  const searchParams = useSearchParams();

  const [form, setForm] =
    useState<FormTemplate | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!formId) return;
    setLoadError(false);

    const token = localStorage.getItem("access_token");
    const query = new URLSearchParams();
    const department = searchParams.get("department");
    const section = searchParams.get("section");
    if (department) query.set("department", department);
    if (section) query.set("section", section);
    fetch(`${API_BASE}/forms/${formId}?${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then(setForm)
      .catch(() => setLoadError(true));
  }, [formId, searchParams]);

  if (loadError) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-primary/20 bg-card p-10 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">دسترسی به فرم امکان‌پذیر نیست</h2>
          <p className="mt-2 text-sm text-muted-foreground">این فرم برای حساب شما فعال نشده یا دیگر وجود ندارد.</p>
          <Link href="/" className="mt-5 inline-block font-bold text-primary">بازگشت به خانه</Link>
        </div>
      </AppShell>
    );
  }

  if (!form) {
    return (
      <AppShell>
        در حال بارگذاری فرم...
      </AppShell>
    );
  }

  const departmentId = searchParams.get("department");
  const backTo = departmentId ? `/departments/${departmentId}` : "/";
  const backLabel = departmentId ? "بازگشت" : "بازگشت به خانه";

  return (
    <AppShell>
      <div className="mb-8">
        <Link
          href={backTo}
          className="
            inline-flex
            items-center
            gap-2
            text-primary
            hover:text-primary
          "
        >
          <ChevronLeft size={18} />
          {backLabel}
        </Link>
      </div>

      <div
        className="
          mb-10
          rounded-3xl
          bg-card
          p-6
          shadow-lg
        "
      >
        <div
          className="
            flex
            flex-col
            gap-6
            md:flex-row
            md:items-center
            md:justify-between
          "
        >
          <div
            className="
              flex
              items-center
              gap-4
            "
          >
            <div
              className="
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-2xl
                bg-primary/10
              "
            >
              <Building2
                className="text-primary"
                size={28}
              />
            </div>

            <div>
              <h1
                className="
                  text-3xl
                  font-bold
                  text-foreground
                "
              >
                {form.title}
              </h1>

              <p
                className="
                  mt-1
                  text-muted-foreground
                "
              >
                لطفاً اطلاعات فرم را تکمیل نمایید
              </p>
            </div>
          </div>

          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                rounded-full
                bg-primary/10
                px-4
                py-2
              "
            >
              <Building2
                size={16}
                className="text-primary"
              />
              <span className="text-sm">
                انتخاب واحد
              </span>
            </div>

            <div className="h-px w-8 bg-slate-300" />

            <div
              className="
                flex
                items-center
                gap-2
                rounded-full
                bg-red-100
                px-4
                py-2
              "
            >
              <FileText
                size={16}
                className="text-primary"
              />
              <span className="text-sm font-medium">
                تکمیل فرم
              </span>
            </div>

            <div className="h-px w-8 bg-slate-300" />

            <div
              className="
                flex
                items-center
                gap-2
                rounded-full
                bg-muted
                px-4
                py-2
              "
            >
              <CheckCircle2
                size={16}
                className="text-muted-foreground"
              />
              <span className="text-sm">
                ثبت نهایی
              </span>
            </div>
          </div>
        </div>
      </div>

      <DynamicForm form={form} />
    </AppShell>
  );
}
