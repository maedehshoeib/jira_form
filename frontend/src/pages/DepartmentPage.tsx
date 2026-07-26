import { ComponentType, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Building2, ChevronLeft, FileArchive, Landmark, Users, Wallet } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { API_BASE, Department } from "../config/portal";
import bankLogo from "../assets/bankmellat_logo_01_s2.png";
import { Card, CardContent } from "../components/ui/card";

export default function DepartmentPage() {
  const { departmentId } = useParams();
  const [department, setDepartment] = useState<Department | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!departmentId || departmentId === "contract-archive") return;
    setLoadError(false);

    const token = localStorage.getItem("access_token");
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    fetch(`${API_BASE}/departments`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((items: Department[]) => {
        setDepartments(items);
        if (departmentId === "resource-development") {
          const hasChild = items.some((item) => item.id === "hr" || item.id === "finance");
          if (!hasChild) setLoadError(true);
        }
      })
      .catch(() => setLoadError(true));

    if (departmentId === "resource-development") {
      setDepartment(null);
      return;
    }

    fetch(`${API_BASE}/departments/${departmentId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then(setDepartment)
      .catch(() => setLoadError(true));
  }, [departmentId]);

  const groupedChildren = useMemo(() => {
    const childIds =
      departmentId === "resource-development"
        ? ["hr", "finance"]
        : departmentId === "business"
          ? ["bank"]
          : departmentId === "contracts"
            ? ["contract-archive"]
            : [];
    return childIds
      .map((id) => departments.find((item) => item.id === id))
      .filter((item): item is Department => Boolean(item));
  }, [departmentId, departments]);

  if (departmentId === "contract-archive") {
    return <Navigate to="/contracts-archive" replace />;
  }

  if (loadError) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-red-100 bg-white p-10 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-800">دسترسی به این بخش امکان‌پذیر نیست</h2>
          <p className="mt-2 text-sm text-slate-500">این بخش برای حساب شما فعال نشده است.</p>
          <Link to="/" className="mt-5 inline-block font-bold text-red-600">بازگشت به خانه</Link>
        </div>
      </AppShell>
    );
  }

  const isResourceDevelopment = departmentId === "resource-development";
  if (!department && !isResourceDevelopment) return <AppShell>در حال بارگذاری...</AppShell>;

  const isBank = department?.id === "bank";
  const isReports = department?.id === "reports";
  const pageTitle = isResourceDevelopment ? "معاونت توسعه منابع" : department!.title;

  const childIcon: Record<string, ComponentType<{ className?: string }>> = {
    hr: Users,
    finance: Wallet,
    bank: Landmark,
    "contract-archive": FileArchive,
  };

  const childLink = (child: Department) =>
    child.id === "contract-archive"
      ? "/contracts-archive"
      : `/departments/${child.id}`;

  return (
    <AppShell>
      <div className="rounded-[2rem] border border-slate-400/70 bg-gradient-to-br from-slate-300 via-slate-200 to-red-200/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_24px_60px_-32px_rgba(15,23,42,0.75)] sm:p-7 lg:p-9">
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
            <h2 className="text-3xl font-bold">{pageTitle}</h2>
          </div>
        </div>

        {groupedChildren.length > 0 && (
          <section className={department?.sections.length ? "mb-10" : ""}>
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500">
            <Building2 className="h-4 w-4 text-red-500" />
            زیرمجموعه‌های این واحد
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {groupedChildren.map((child) => {
              const Icon = childIcon[child.id] || Building2;
              return (
                <Link key={child.id} to={childLink(child)}>
                  <Card className="group h-full rounded-3xl border border-slate-300 bg-white shadow-[0_14px_32px_-18px_rgba(15,23,42,0.75)] transition-all hover:-translate-y-1 hover:border-red-200 hover:shadow-[0_22px_40px_-18px_rgba(127,29,29,0.6)]">
                    <CardContent className="flex items-center gap-4 p-6">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800">{child.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {child.id === "contract-archive"
                            ? "مشاهده آرشیو قراردادها"
                            : `${child.sections.length.toLocaleString("fa-IR")} خدمت`}
                        </p>
                      </div>
                      <ChevronLeft className="h-5 w-5 text-red-400 transition-transform group-hover:-translate-x-1" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          </section>
        )}

        {isReports && (
          <div className="mb-8">
          <Link to="/reports/performance">
            <Card className="rounded-3xl border border-red-200 bg-red-50 shadow-[0_14px_32px_-18px_rgba(127,29,29,0.6)] transition hover:-translate-y-1 hover:shadow-[0_22px_40px_-18px_rgba(127,29,29,0.7)]">
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

        <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
        {(department?.sections || []).map((s) => (
          <Link
            key={s.id}
            to={`/forms/${s.form_id}?department=${department!.id}&section=${s.id}`}
          >
            <Card
              className="
                h-full
                cursor-pointer
                border
                border-slate-300
                rounded-3xl
                bg-white/95
                shadow-[0_16px_36px_-18px_rgba(15,23,42,0.8)]
                transition-all
                duration-300
                hover:-translate-y-2
                hover:border-red-200
                hover:shadow-[0_24px_46px_-18px_rgba(127,29,29,0.65)]
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
      </div>
    </AppShell>
  );
}
