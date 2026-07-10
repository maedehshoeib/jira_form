import { useEffect, useState } from "react";

import AppShell from "../../components/layout/AppShell";
import client from "../../api/client";
import { endpoints } from "../../api/endpoints";

import ReportSection from "../../components/reports/ReportSection";
import SummaryTable from "../../components/reports/SummaryTable";
import TextSection from "../../components/reports/TextSection";
import ReportTable from "../../components/reports/ReportTable";
import ReportHeader from "../../components/reports/ReportHeader";

type PerformanceData = {
  summary: { label: string; value: string }[];
  achievements: string;
  challenges: string;
  goals: { columns: { key: string; title: string }[]; rows: Record<string, string>[] };
  actions: { columns: { key: string; title: string }[]; rows: Record<string, string>[] };
  metrics: { columns: { key: string; title: string }[]; rows: Record<string, string>[] };
  analysis: string;
  risks: string;
  corrective_actions: string;
  next_plans: string;
  management_decisions: string;
};

export default function PerformanceReports() {
  const [report, setReport] = useState<{
    title: string;
    status: string;
    created_by: string;
    created_at: string;
    data: PerformanceData;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get(endpoints.reportsPerformance)
      .then((res) => setReport(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <AppShell>در حال بارگذاری گزارش...</AppShell>;
  }

  if (!report) {
    return <AppShell>گزارشی یافت نشد.</AppShell>;
  }

  const data = report.data;

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">{report.title}</h1>
          <p className="mt-2 text-slate-500">
            اطلاعات ثبت شده فرم‌ها در این قسمت نمایش داده می‌شود.
          </p>
        </div>

        <ReportHeader
          title={report.title}
          createdAt={report.created_at}
          createdBy={report.created_by}
          status={report.status}
        />

        <ReportSection title="مشخصات کلی گزارش">
          <SummaryTable items={data.summary} />
        </ReportSection>

        <ReportSection title="مهمترین دستاوردهای دوره">
          <TextSection title="" value={data.achievements} />
        </ReportSection>

        <ReportSection title="مهمترین مشکلات و چالش‌ها">
          <TextSection title="" value={data.challenges} />
        </ReportSection>

        <ReportSection title="اهداف و برنامه‌های دوره">
          <ReportTable columns={data.goals.columns} rows={data.goals.rows} />
        </ReportSection>

        <ReportSection title="اقدامات انجام شده">
          <ReportTable columns={data.actions.columns} rows={data.actions.rows} />
        </ReportSection>

        <ReportSection title="شاخص‌های عملکرد">
          <ReportTable columns={data.metrics.columns} rows={data.metrics.rows} />
        </ReportSection>

        <ReportSection title="تحلیل عملکرد">
          <TextSection title="" value={data.analysis} />
        </ReportSection>

        <ReportSection title="ریسک‌ها و مشکلات">
          <TextSection title="" value={data.risks} />
        </ReportSection>

        <ReportSection title="اقدامات اصلاحی">
          <TextSection title="" value={data.corrective_actions} />
        </ReportSection>

        <ReportSection title="برنامه‌های دوره بعد">
          <TextSection title="" value={data.next_plans} />
        </ReportSection>

        <ReportSection title="تصمیمات مورد نیاز مدیریت">
          <TextSection title="" value={data.management_decisions} />
        </ReportSection>
      </div>
    </AppShell>
  );
}
