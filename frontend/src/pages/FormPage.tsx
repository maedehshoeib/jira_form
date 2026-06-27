import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  ChevronLeft,
  Building2,
  FileText,
  CheckCircle2,
} from 'lucide-react';

import AppShell from '../components/layout/AppShell';
import { API_BASE, FormTemplate } from '../config/portal';
import DynamicForm from '../components/forms/DynamicForm';

export default function FormPage() {
  const { formId } = useParams();

  const [form, setForm] =
    useState<FormTemplate | null>(null);

  useEffect(() => {
    if (!formId) return;

    fetch(`${API_BASE}/forms/${formId}`)
      .then((res) => res.json())
      .then(setForm);
  }, [formId]);

  if (!form) {
    return (
      <AppShell>
        در حال بارگذاری فرم...
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-8">
        <Link
          to="/"
          className="
            inline-flex
            items-center
            gap-2
            text-red-600
            hover:text-red-700
          "
        >
          <ChevronLeft size={18} />
          بازگشت به خانه
        </Link>
      </div>

      <div
        className="
          mb-10
          rounded-3xl
          bg-white
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
                bg-red-50
              "
            >
              <Building2
                className="text-red-600"
                size={28}
              />
            </div>

            <div>
              <h1
                className="
                  text-3xl
                  font-bold
                  text-slate-800
                "
              >
                {form.title}
              </h1>

              <p
                className="
                  mt-1
                  text-slate-500
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
                bg-red-50
                px-4
                py-2
              "
            >
              <Building2
                size={16}
                className="text-red-600"
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
                className="text-red-600"
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
                bg-slate-100
                px-4
                py-2
              "
            >
              <CheckCircle2
                size={16}
                className="text-slate-500"
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