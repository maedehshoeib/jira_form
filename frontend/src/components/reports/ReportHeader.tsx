import { FileSpreadsheet, Printer, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { Link } from "react-router-dom";
import { formatPersianDateTime } from "../../lib/persianDate";

interface Props {
  title: string;
  createdAt: string;
  status: string;
  createdBy: string;
  onPrint?: () => void;
  onExportExcel?: () => void;
}

export default function ReportHeader({
  title,
  createdAt,
  status,
  createdBy,
  onPrint,
  onExportExcel,
}: Props) {
  return (
    <div className="rounded-3xl bg-card shadow-xl border border-border p-8">

      <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">

        <div>

          <Link
            to="/departments/reports"
            className="no-print mb-4 inline-flex items-center gap-2 text-primary hover:text-primary"
          >
            <ArrowRight size={18} />
            بازگشت
          </Link>

          <h1 className="text-3xl font-black text-foreground">
            {title}
          </h1>

          <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">

            <span>
              📅 {formatPersianDateTime(createdAt)}
            </span>

            <span>
              👤 {createdBy}
            </span>

            <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
              {status}
            </span>

          </div>

        </div>

        <div className="no-print flex gap-3">

          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={onPrint}
          >
            <Printer className="ml-2 h-4 w-4" />
            چاپ
          </Button>

          <Button
            type="button"
            className="rounded-xl bg-primary hover:bg-primary/90"
            onClick={onExportExcel}
          >
            <FileSpreadsheet className="ml-2 h-4 w-4" />
            خروجی Excel
          </Button>

        </div>

      </div>

    </div>
  );
}
