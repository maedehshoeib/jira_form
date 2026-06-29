import { FileSpreadsheet, Printer, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { Link } from "react-router-dom";

interface Props {
  title: string;
  createdAt: string;
  status: string;
  createdBy: string;
}

export default function ReportHeader({
  title,
  createdAt,
  status,
  createdBy,
}: Props) {
  return (
    <div className="rounded-3xl bg-white shadow-xl border border-slate-200 p-8">

      <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">

        <div>

          <Link
            to="/reports"
            className="mb-4 inline-flex items-center gap-2 text-red-600 hover:text-red-700"
          >
            <ArrowRight size={18} />
            بازگشت
          </Link>

          <h1 className="text-3xl font-black text-slate-800">
            {title}
          </h1>

          <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-500">

            <span>
              📅 {createdAt}
            </span>

            <span>
              👤 {createdBy}
            </span>

            <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
              {status}
            </span>

          </div>

        </div>

        <div className="flex gap-3">

          <Button
            variant="outline"
            className="rounded-xl"
          >
            <Printer className="ml-2 h-4 w-4" />
            چاپ
          </Button>

          <Button
            className="rounded-xl bg-red-600 hover:bg-red-700"
          >
            <FileSpreadsheet className="ml-2 h-4 w-4" />
            خروجی Excel
          </Button>

        </div>

      </div>

    </div>
  );
}