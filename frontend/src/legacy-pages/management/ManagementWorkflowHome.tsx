import { Link, Navigate } from "react-router-dom";
import { BarChart3, ChevronLeft, Network, Send } from "lucide-react";
import { useEffect, useState } from "react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import AppShell from "../../components/layout/AppShell";
import { Card, CardContent } from "../../components/ui/card";
import { LETTER_WORKFLOWS, LetterType } from "./letterWorkflow";

export default function ManagementWorkflowHome({
  letterType,
}: {
  letterType: LetterType;
}) {
  const workflow = LETTER_WORKFLOWS[letterType];
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    client
      .get<{ allowed: boolean }>(endpoints.managementLetterAccess, {
        params: { letter_type: letterType },
      })
      .then(({ data }) => setAllowed(data.allowed))
      .catch(() => setAllowed(false));
  }, [letterType]);

  if (allowed === null) {
    return (
      <AppShell>
        <p className="text-slate-600">در حال بارگذاری...</p>
      </AppShell>
    );
  }

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-semibold text-red-600 hover:text-red-700"
        >
          <ChevronLeft size={18} />
          بازگشت به خانه
        </Link>

        <div className="mt-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700">
            <Network className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">
              {workflow.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {workflow.description}
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Link to={`${workflow.homePath}/send`}>
            <Card className="group h-full rounded-3xl border border-slate-200 transition hover:-translate-y-1 hover:border-red-200 hover:shadow-lg">
              <CardContent className="p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <Send size={32} />
                </div>
                <h2 className="mt-6 text-xl font-bold text-slate-900">ارسال نامه</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  ثبت موضوع، توضیحات و پیوست و ارسال به گیرندگان منتخب
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to={`${workflow.homePath}/report`}>
            <Card className="group h-full rounded-3xl border border-slate-200 transition hover:-translate-y-1 hover:border-red-200 hover:shadow-lg">
              <CardContent className="p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <BarChart3 size={32} />
                </div>
                <h2 className="mt-6 text-xl font-bold text-slate-900">گزارش</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  پیگیری وضعیت نامه‌های ارسال‌شده برای هر گیرنده
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
