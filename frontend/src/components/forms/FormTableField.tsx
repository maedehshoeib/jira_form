import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

import { TableColumn } from "../../config/portal";
import { Input } from "../ui/input";

type Props = {
  columns: TableColumn[];
  rows: Record<string, string>[];
  defaultRows?: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
};

function emptyRow(columns: TableColumn[]): Record<string, string> {
  return Object.fromEntries(columns.map((col) => [col.key, ""]));
}

function isFixedAxisRow(
  row: Record<string, string>,
  columns: TableColumn[],
  defaultRows?: Record<string, string>[]
): boolean {
  if (!defaultRows?.length) return false;
  const axisKey = columns[0]?.key;
  if (!axisKey) return false;
  return defaultRows.some((d) => d[axisKey] === row[axisKey]);
}

export default function FormTableField({
  columns,
  rows,
  defaultRows,
  onChange,
}: Props) {
  const handleCellChange = (
    rowIndex: number,
    key: string,
    value: string
  ) => {
    const next = rows.map((row, i) =>
      i === rowIndex ? { ...row, [key]: value } : row
    );
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...rows, emptyRow(columns)]);
  };

  const handleDelete = (index: number) => {
    if (isFixedAxisRow(rows[index], columns, defaultRows)) return;
    onChange(rows.filter((_, i) => i !== index));
  };

  const canDelete = (index: number) =>
    !isFixedAxisRow(rows[index], columns, defaultRows);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {rows.length} ردیف
        </span>
        <Button variant="ghost"
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90"
        >
          <Plus size={16} />
          افزودن ردیف
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="border px-3 py-2 text-center font-semibold w-12">
                ردیف
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="border px-3 py-2 text-center font-semibold whitespace-nowrap"
                >
                  {col.title}
                </th>
              ))}
              <th className="border px-3 py-2 w-16 text-center font-semibold">
                عملیات
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="py-8 text-center text-muted-foreground"
                >
                  ردیفی اضافه نشده است. روی «افزودن ردیف» کلیک کنید.
                </td>
              </tr>
            )}
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-muted/40">
                <td className="border px-3 py-2 text-center text-muted-foreground">
                  {rowIndex + 1}
                </td>
                {columns.map((col) => {
                  const isFixed =
                    isFixedAxisRow(row, columns, defaultRows) &&
                    col.key === columns[0]?.key;

                  return (
                    <td key={col.key} className="border px-2 py-1">
                      <Input
                        className="h-10 rounded-lg border-border bg-card text-right text-sm"
                        value={row[col.key] ?? ""}
                        readOnly={isFixed}
                        onChange={(e) =>
                          handleCellChange(
                            rowIndex,
                            col.key,
                            e.target.value
                          )
                        }
                      />
                    </td>
                  );
                })}
                <td className="border text-center">
                  {canDelete(rowIndex) ? (
                    <Button variant="ghost"
                      type="button"
                      onClick={() => handleDelete(rowIndex)}
                      className="text-primary hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </Button>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
