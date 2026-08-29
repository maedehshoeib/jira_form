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
            border-border
            bg-muted/40
            p-4
          "
        >

          <div className="mb-2 text-sm text-muted-foreground">
            {item.label}
          </div>

          <div className="font-semibold text-foreground">
            {item.value}
          </div>

        </div>

      ))}

    </div>
  );
}