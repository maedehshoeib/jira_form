export type PerformanceTableSection = {
  columns: { key: string; title: string }[];
  rows: Record<string, string>[];
};

export type PerformanceReportExport = {
  id?: number;
  title: string;
  status: string;
  created_by: string;
  created_at: string;
  data: {
    general_specs?: PerformanceTableSection;
    achievements: string;
    problems_risks_summary?: string;
    management_decisions_summary?: string;
    next_period_key_programs?: string;
    goals: PerformanceTableSection;
    actions: PerformanceTableSection;
    metrics: PerformanceTableSection;
    analysis: PerformanceTableSection | string;
    risks: PerformanceTableSection | string;
    corrective_actions: PerformanceTableSection | string;
    next_plans: PerformanceTableSection | string;
    management_decisions: PerformanceTableSection | string;
    attachments?: PerformanceTableSection;
    manager_scoring?: PerformanceTableSection;
    summary?: { label: string; value: string }[];
    challenges?: string;
  };
};

function escapeCsv(value: string): string {
  const normalized = value.replace(/\r?\n/g, " ").trim();
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function tableSection(
  title: string,
  section: PerformanceTableSection | string | undefined
): string[] {
  if (!section) return [`\n${title}`, "(بدون داده)"];

  if (typeof section === "string") {
    return [`\n${title}`, escapeCsv(section || "(بدون داده)")];
  }

  const lines = [`\n${title}`, section.columns.map((c) => c.title).join(",")];
  for (const row of section.rows) {
    lines.push(
      section.columns.map((c) => escapeCsv(row[c.key] ?? "")).join(",")
    );
  }
  if (section.rows.length === 0) {
    lines.push("(بدون داده)");
  }
  return lines;
}

function textSection(title: string, value: string): string[] {
  return [`\n${title}`, escapeCsv(value || "(بدون داده)")];
}

export function exportPerformanceReportToExcel(
  report: PerformanceReportExport
): void {
  const { data } = report;

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
      : undefined);

  const lines: string[] = [
    "عنوان گزارش," + escapeCsv(report.title),
    "ثبت کننده," + escapeCsv(report.created_by),
    "تاریخ ثبت," + escapeCsv(report.created_at),
    "وضعیت," + escapeCsv(report.status),
    ...tableSection("مشخصات کلی گزارش", generalSpecs),
    ...textSection("مهم‌ترین دستاوردهای دوره", data.achievements || ""),
    ...textSection(
      "مهم‌ترین مشکلات و ریسک‌ها",
      data.problems_risks_summary || data.challenges || ""
    ),
    ...textSection(
      "مهم‌ترین تصمیمات مورد نیاز از مدیریت",
      data.management_decisions_summary || ""
    ),
    ...textSection(
      "برنامه‌های کلیدی دوره بعد",
      data.next_period_key_programs || ""
    ),
    ...tableSection("اهداف و برنامه‌های دوره", data.goals),
    ...tableSection("اقدامات انجام شده", data.actions),
    ...tableSection("شاخص‌های عملکردی واحد", data.metrics),
    ...tableSection("تحلیل عملکرد", data.analysis),
    ...tableSection("مشکلات، موانع و ریسک‌ها", data.risks),
    ...tableSection("اقدامات اصلاحی و پیشنهادی", data.corrective_actions),
    ...tableSection("برنامه دوره بعد", data.next_plans),
    ...tableSection("تصمیمات مورد نیاز از مدیریت", data.management_decisions),
    ...tableSection("پیوست‌ها و مستندات", data.attachments),
    ...tableSection(
      "فرم امتیازدهی و جمع‌بندی مدیر واحد",
      data.manager_scoring
    ),
  ];

  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const suffix = report.id ? `-${report.id}` : "";
  link.href = url;
  link.download = `performance-report${suffix}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function printPerformanceReport(): void {
  window.print();
}
