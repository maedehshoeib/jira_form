import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

export interface TableColumn {
  key: string;
  title: string;
  width?: string;
}

interface ReportTableProps {
  columns: TableColumn[];
  rows: Record<string, any>[];
  onAdd?: () => void;
  onDelete?: (index: number) => void;
  editable?: boolean;
}

export default function ReportTable({
  columns,
  rows,
  onAdd,
  onDelete,
  editable = false,
}: ReportTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">

      {/* Header */}

      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">

        <h3 className="font-semibold text-foreground">
          جدول اطلاعات
        </h3>

        {editable && (
          <Button variant="ghost"
            onClick={onAdd}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-white hover:bg-primary/90"
          >
            <Plus size={18} />
            افزودن ردیف
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">

        <Table className="w-full text-sm">

          <thead className="bg-muted">

            <tr>

              {columns.map((column) => (

                <th
                  key={column.key}
                  className="border px-4 py-3 text-center font-semibold whitespace-nowrap"
                >
                  {column.title}
                </th>

              ))}

              {editable && (

                <th className="border px-4 py-3 w-20">
                  عملیات
                </th>

              )}

            </tr>

          </thead>

          <tbody>

            {rows.length === 0 && (

              <tr>

                <td
                  colSpan={
                    editable
                      ? columns.length + 1
                      : columns.length
                  }
                  className="py-10 text-center text-muted-foreground"
                >
                  داده‌ای ثبت نشده است.
                </td>

              </tr>

            )}

            {rows.map((row, rowIndex) => (

              <tr
                key={rowIndex}
                className="hover:bg-muted/40"
              >

                {columns.map((column) => (

                  <td
                    key={column.key}
                    className="border px-3 py-2 text-center"
                  >
                    {row[column.key]}
                  </td>

                ))}

                {editable && (

                  <td className="border text-center">

                    <Button variant="ghost"
                      onClick={() => onDelete?.(rowIndex)}
                      className="text-primary hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </Button>

                  </td>

                )}

              </tr>

            ))}

          </tbody>

        </Table>

      </div>

    </div>
  );
}