import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { API_BASE, Department } from "../config/portal";
import bankLogo from "../assets/bankmellat_logo_01_s2.png";
import { Card, CardContent } from "../components/ui/card";

export default function DepartmentPage() {
  const { departmentId } = useParams();
  const [department, setDepartment] = useState<Department | null>(null);

  useEffect(() => {
    if (!departmentId) return;

    const token = localStorage.getItem("access_token");
    fetch(`${API_BASE}/departments/${departmentId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then(setDepartment);
  }, [departmentId]);

  if (!department) return <AppShell>در حال بارگذاری...</AppShell>;

  const isBank = department.id === "bank";
  const isReports = department.id === "reports";

  return (
    <AppShell>
      <div className="mb-10 flex items-center justify-between">
        <Link
          to="/"
          className="font-medium text-red-600 hover:text-red-700"
        >
          بازگشت
        </Link>

        <div className="flex items-center gap-4">
          {isBank && (
            <img
              src={bankLogo}
              alt="بانک ملت"
              className="h-14 object-contain"
            />
          )}
          <h2 className="text-3xl font-bold">{department.title}</h2>
        </div>
      </div>

      {isReports && (
        <div className="mb-8">
          <Link to="/reports/performance">
            <Card className="rounded-3xl border border-red-100 bg-red-50/50 shadow-md transition hover:shadow-lg">
              <CardContent className="p-6 text-right">
                <h3 className="text-lg font-bold text-slate-800">
                  مشاهده آخرین گزارش ثبت‌شده
                </h3>
                <p className="mt-2 text-sm text-red-600">
                  ورود به صفحه گزارش عملکرد
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {department.sections.map((s) => (
          <Link
            key={s.id}
            to={`/forms/${s.form_id}?department=${department.id}&section=${s.id}`}
          >
            <Card
              className="
                h-full
                cursor-pointer
                border-0
                rounded-3xl
                bg-white/95
                shadow-md
                transition-all
                duration-300
                hover:-translate-y-2
                hover:shadow-xl
                hover:shadow-red-100
              "
            >
              <CardContent className="p-8 text-right">
                {isBank && (
                  <img
                    src={bankLogo}
                    alt="بانک ملت"
                    className="mb-4 h-10 object-contain"
                  />
                )}
                <h3 className="text-xl font-bold text-slate-800">{s.title}</h3>
                <p className="mt-3 text-sm text-red-500">ورود به فرم</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
