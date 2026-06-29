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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">

      {/* Header */}

      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">

        <h3 className="font-semibold text-slate-700">
          جدول اطلاعات
        </h3>

        {editable && (
          <button
            onClick={onAdd}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700"
          >
            <Plus size={18} />
            افزودن ردیف
          </button>
        )}
      </div>

      <div className="overflow-x-auto">

        <table className="w-full text-sm">

          <thead className="bg-slate-100">

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
                  className="py-10 text-center text-slate-400"
                >
                  داده‌ای ثبت نشده است.
                </td>

              </tr>

            )}

            {rows.map((row, rowIndex) => (

              <tr
                key={rowIndex}
                className="hover:bg-slate-50"
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

                    <button
                      onClick={() => onDelete?.(rowIndex)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </button>

                  </td>

                )}

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}