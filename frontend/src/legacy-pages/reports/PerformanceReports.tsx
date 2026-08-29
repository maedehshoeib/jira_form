import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import AppShell from "../../components/layout/AppShell";
import client from "../../api/client";
import { endpoints } from "../../api/endpoints";

import ReportSection from "../../components/reports/ReportSection";
import TextSection from "../../components/reports/TextSection";
import ReportTable from "../../components/reports/ReportTable";
import ReportHeader from "../../components/reports/ReportHeader";
import {
  exportPerformanceReportToExcel,
  printPerformanceReport,
  type PerformanceReportExport,
  type PerformanceTableSection,
} from "../../lib/reportExport";

type TableSection = {
  columns: { key: string; title: string }[];
  rows: Record<string, string>[];
};

type PerformanceData = {
  general_specs?: TableSection;
  achievements: string;
  problems_risks_summary?: string;
  management_decisions_summary?: string;
  next_period_key_programs?: string;
  goals: TableSection;
  actions: TableSection;
  metrics: TableSection;
  analysis: TableSection | string;
  risks: TableSection | string;
  corrective_actions: TableSection | string;
  next_plans: TableSection | string;
  management_decisions: TableSection | string;
  attachments?: TableSection;
  manager_scoring?: TableSection;
  summary?: { label: string; value: string }[];
  challenges?: string;
};

function emptyTable(): TableSection {
  return { columns: [], rows: [] };
}

function asTable(
  value: TableSection | string | undefined,
  fallbackColumns: { key: string; title: string }[] = []
): TableSection {
  if (!value) return { columns: fallbackColumns, rows: [] };
  if (typeof value === "string") {
    return {
      columns: [{ key: "content", title: "متن" }],
      rows: value.trim() ? [{ content: value }] : [],
    };
  }
  return value;
}

function normalizeData(data: PerformanceData): PerformanceData {
  const generalSpecs =
    data.general_specs ??
    (data.summary
      ? {
          columns: [
            { key: "title", title: "عنوان" },
            { key: "value", title: "شرح/مقدار" },
          ],
          rows: data.summary.map((item) => ({
            title: item.label,
            value: item.value,
          })),
        }
      : emptyTable());

  return {
    ...data,
    general_specs: generalSpecs,
    problems_risks_summary:
      data.problems_risks_summary ?? data.challenges ?? "",
    management_decisions_summary: data.management_decisions_summary ?? "",
    next_period_key_programs: data.next_period_key_programs ?? "",
    goals: data.goals ?? emptyTable(),
    actions: data.actions ?? emptyTable(),
    metrics: data.metrics ?? emptyTable(),
    analysis: asTable(data.analysis),
    risks: asTable(data.risks),
    corrective_actions: asTable(data.corrective_actions),
    next_plans: asTable(data.next_plans),
    management_decisions: asTable(data.management_decisions),
    attachments: data.attachments ?? emptyTable(),
    manager_scoring: data.manager_scoring ?? emptyTable(),
  };
}

export default function PerformanceReports() {
  const [report, setReport] = useState<PerformanceReportExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    client
      .get(endpoints.reportsPerformance)
      .then((res) => setReport(res.data))
      .catch((err) => {
        if (err?.response?.status === 404) {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <AppShell>در حال بارگذاری گزارش...</AppShell>;
  }

  if (notFound || !report) {
    return (
      <AppShell>
        <div className="space-y-6 text-center">
          <h1 className="text-3xl font-bold text-foreground">
            گزارش عملکرد شورای معاونین و مدیران
          </h1>
          <p className="text-muted-foreground">
            هنوز گزارشی ثبت نشده است. لطفاً ابتدا فرم گزارش را تکمیل کنید.
          </p>
          <Link
            to="/departments/reports"
            className="inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary/90"
          >
            رفتن به فرم ثبت گزارش
          </Link>
        </div>
      </AppShell>
    );
  }

  const data = normalizeData(report.data as PerformanceData);

  const tableSections: { title: string; section: PerformanceTableSection }[] = [
    { title: "مشخصات کلی گزارش", section: data.general_specs! },
    { title: "اهداف و برنامه‌های دوره", section: data.goals },
    { title: "اقدامات انجام شده", section: data.actions },
    { title: "شاخص‌های عملکردی واحد", section: data.metrics },
    { title: "تحلیل عملکرد", section: data.analysis as TableSection },
    { title: "مشکلات، موانع و ریسک‌ها", section: data.risks as TableSection },
    {
      title: "اقدامات اصلاحی و پیشنهادی",
      section: data.corrective_actions as TableSection,
    },
    { title: "برنامه دوره بعد", section: data.next_plans as TableSection },
    {
      title: "تصمیمات مورد نیاز از مدیریت",
      section: data.management_decisions as TableSection,
    },
    { title: "پیوست‌ها و مستندات", section: data.attachments! },
    {
      title: "فرم امتیازدهی و جمع‌بندی مدیر واحد",
      section: data.manager_scoring!,
    },
  ];

  return (
    <AppShell>
      <div id="report-print-area" className="space-y-8">
        <div className="no-print">
          <h1 className="text-3xl font-bold text-foreground">{report.title}</h1>
          <p className="mt-2 text-muted-foreground">
            اطلاعات ثبت‌شده توسط کاربران در فرم گزارش
          </p>
        </div>

        <ReportHeader
          title={report.title}
          createdAt={report.created_at}
          createdBy={report.created_by}
          status={report.status}
          onPrint={printPerformanceReport}
          onExportExcel={() => exportPerformanceReportToExcel(report)}
        />

        <ReportSection title="مشخصات کلی گزارش">
          <ReportTable
            columns={data.general_specs!.columns}
            rows={data.general_specs!.rows}
          />
        </ReportSection>

        <ReportSection title="مهم‌ترین دستاوردهای دوره">
          <TextSection title="" value={data.achievements} />
        </ReportSection>

        <ReportSection title="مهم‌ترین مشکلات و ریسک‌ها">
          <TextSection title="" value={data.problems_risks_summary ?? ""} />
        </ReportSection>

        <ReportSection title="مهم‌ترین تصمیمات مورد نیاز از مدیریت">
          <TextSection
            title=""
            value={data.management_decisions_summary ?? ""}
          />
        </ReportSection>

        <ReportSection title="برنامه‌های کلیدی دوره بعد">
          <TextSection title="" value={data.next_period_key_programs ?? ""} />
        </ReportSection>

        {tableSections.slice(1).map(({ title, section }) => (
          <ReportSection key={title} title={title}>
            <ReportTable columns={section.columns} rows={section.rows} />
          </ReportSection>
        ))}
      </div>
    </AppShell>
  );
}
