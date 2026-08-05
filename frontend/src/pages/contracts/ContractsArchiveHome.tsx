import { Link } from "react-router-dom";
import AppShell from "../../components/layout/AppShell";
import { Card, CardContent } from "../../components/ui/card";
import { Archive, FilePlus, List } from "lucide-react";

export default function ContractsArchiveHome() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <Link to="/departments/contracts" className="font-semibold text-red-600">
          بازگشت
        </Link>

        <h1 className="mt-8 text-4xl font-bold">ارشیو قراردادها</h1>
        <p className="mt-2 text-slate-500">
          ثبت و مشاهده قراردادهای آرشیو شده
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Link to="/contracts-archive/submit">
            <Card className="rounded-3xl transition hover:shadow-xl">
              <CardContent className="p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
                  <FilePlus className="text-red-600" size={34} />
                </div>
                <h2 className="mt-6 text-xl font-bold">ثبت قراردادها</h2>
                <p className="mt-2 text-slate-500">
                  ثبت قرارداد جدید در آرشیو
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/contracts-archive/list">
            <Card className="rounded-3xl transition hover:shadow-xl">
              <CardContent className="p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
                  <List className="text-red-600" size={34} />
                </div>
                <h2 className="mt-6 text-xl font-bold">گزارش قراردادها</h2>
                <p className="mt-2 text-slate-500">
                  مشاهده فهرست قراردادهای ثبت‌شده
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mt-8 flex items-center gap-2 text-sm text-slate-400">
          <Archive size={16} />
          <span></span>
        </div>
      </div>
    </AppShell>
  );
}
