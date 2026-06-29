interface SummaryItem {
  label: string;
  value: string;
}

interface SummaryTableProps {
  items: SummaryItem[];
}

export default function SummaryTable({
  items,
}: SummaryTableProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">

      {items.map((item) => (

        <div
          key={item.label}
          className="
            rounded-xl
            border
            border-slate-200
            bg-slate-50
            p-4
          "
        >

          <div className="mb-2 text-sm text-slate-500">
            {item.label}
          </div>

          <div className="font-semibold text-slate-800">
            {item.value}
          </div>

        </div>

      ))}

    </div>
  );
}