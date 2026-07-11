export type PerformanceReportExport = {
  id?: number;
  title: string;
  status: string;
  created_by: string;
  created_at: string;
  data: {
    summary: { label: string; value: string }[];
    achievements: string;
    challenges: string;
    goals: {
      columns: { key: string; title: string }[];
      rows: Record<string, string>[];
    };
    actions: {
      columns: { key: string; title: string }[];
      rows: Record<string, string>[];
    };
    metrics: {
      columns: { key: string; title: string }[];
      rows: Record<string, string>[];
    };
    analysis: string;
    risks: string;
    corrective_actions: string;
    next_plans: string;
    management_decisions: string;
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
  columns: { key: string; title: string }[],
  rows: Record<string, string>[]
): string[] {
  const lines = [`\n${title}`, columns.map((c) => c.title).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsv(row[c.key] ?? "")).join(","));
  }
  if (rows.length === 0) {
    lines.push("(بدون داده)");
  }
  return lines;
}

export function exportPerformanceReportToExcel(report: PerformanceReportExport): void {
  const { data } = report;
  const lines: string[] = [
    "عنوان گزارش," + escapeCsv(report.title),
    "ثبت کننده," + escapeCsv(report.created_by),
    "تاریخ ثبت," + escapeCsv(report.created_at),
    "وضعیت," + escapeCsv(report.status),
    "",
    "مشخصات کلی",
    "عنوان,مقدار",
    ...data.summary.map((item) => `${escapeCsv(item.label)},${escapeCsv(item.value)}`),
    "",
    "مهمترین دستاوردهای دوره",
    escapeCsv(data.achievements || ""),
    "",
    "مهمترین مشکلات و چالش‌ها",
    escapeCsv(data.challenges || ""),
    ...tableSection("اهداف و برنامه‌های دوره", data.goals.columns, data.goals.rows),
    ...tableSection("اقدامات انجام شده", data.actions.columns, data.actions.rows),
    ...tableSection("شاخص‌های عملکرد", data.metrics.columns, data.metrics.rows),
    "",
    "تحلیل عملکرد",
    escapeCsv(data.analysis || ""),
    "",
    "ریسک‌ها و مشکلات",
    escapeCsv(data.risks || ""),
    "",
    "اقدامات اصلاحی",
    escapeCsv(data.corrective_actions || ""),
    "",
    "برنامه‌های دوره بعد",
    escapeCsv(data.next_plans || ""),
    "",
    "تصمیمات مورد نیاز مدیریت",
    escapeCsv(data.management_decisions || ""),
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
