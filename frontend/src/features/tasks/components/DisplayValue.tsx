import { Table } from "@/components/ui/table";
import type { FormField } from "@/config/portal";

export function DisplayValue(value: unknown, field?: FormField) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">ثبت نشده</span>;
  }

  if (field?.type === "select") {
    const option = field.options?.find((item) => item.value === String(value));
    return option?.label ?? String(value);
  }

  if (Array.isArray(value)) {
    const rows = value.filter(
      (row) => row && typeof row === "object" && Object.values(row).some(Boolean),
    ) as Record<string, unknown>[];
    if (!rows.length) return <span className="text-muted-foreground">ثبت نشده</span>;

    const columns = field?.columns?.length
      ? field.columns
      : Object.keys(rows[0]).map((key) => ({ key, title: key }));

    return (
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-muted/40">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="whitespace-nowrap px-3 py-2 text-right font-semibold text-muted-foreground"
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-card">
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="whitespace-pre-wrap px-3 py-2 text-foreground"
                  >
                    {String(row[column.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }

  if (typeof value === "object") {
    return <pre className="overflow-x-auto text-xs">{JSON.stringify(value, null, 2)}</pre>;
  }

  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}
