import { ComponentType, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Building2, ChevronLeft, FileArchive, Landmark, Users, Wallet } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { API_BASE, Department } from "../config/portal";
import bankLogo from "../assets/bankmellat_logo_01_s2.png";
import { assetUrl } from "../lib/assetUrl";
import { Card, CardContent } from "../components/ui/card";
import { cn } from "../lib/utils";

const surfaceCard =
  "rounded-3xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-primary/30 hover:shadow-lg hover:shadow-red-100/50 dark:border-white/65 dark:bg-gradient-to-br dark:from-white/[0.23] dark:via-slate-100/[0.10] dark:to-cyan-100/[0.05] dark:shadow-[inset_1px_1px_0_rgba(255,255,255,0.85),inset_-1px_-1px_0_rgba(186,230,253,0.14),0_0_24px_rgba(224,242,254,0.11),0_20px_45px_-24px_rgba(0,0,0,0.85)] dark:ring-1 dark:ring-cyan-100/20 dark:backdrop-blur-2xl dark:saturate-150 dark:hover:border-primary/70 dark:hover:bg-card/[0.16] dark:hover:shadow-[0_24px_48px_-18px_rgba(239,68,68,0.35)]";

export default function DepartmentPage() {
  const { departmentId } = useParams();
  const [department, setDepartment] = useState<Department | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (
      !departmentId ||
      departmentId === "contract-archive" ||
      departmentId === "management-workflow" ||
      departmentId === "internal-letters"
    )
      return;
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

  if (departmentId === "management-workflow") {
    return <Navigate to="/management-workflow/external" replace />;
  }

  if (departmentId === "internal-letters") {
    return <Navigate to="/management-workflow/internal" replace />;
  }

  if (loadError) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-primary/20 bg-card p-10 text-center shadow-sm dark:border-red-900/50 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-foreground dark:text-white">دسترسی به این بخش امکان‌پذیر نیست</h2>
          <p className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground">این بخش برای حساب شما فعال نشده است.</p>
          <Link to="/" className="mt-5 inline-block font-bold text-primary dark:text-red-400">بازگشت به خانه</Link>
        </div>
      </AppShell>
    );
  }

  const isResourceDevelopment = departmentId === "resource-development";
  if (!department && !isResourceDevelopment) {
    return (
      <AppShell>
        <p className="text-muted-foreground dark:text-slate-300">در حال بارگذاری...</p>
      </AppShell>
    );
  }

  const isBank = department?.id === "bank";
  const isReports = department?.id === "reports";
  const pageTitle = isResourceDevelopment ? "معاونت توسعه منابع" : department!.title;

  const parentDepartmentById: Record<string, string> = {
    hr: "resource-development",
    finance: "resource-development",
    bank: "business",
  };
  const backTo = departmentId && parentDepartmentById[departmentId]
    ? `/departments/${parentDepartmentById[departmentId]}`
    : "/";

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
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-border bg-card p-5 shadow-sm dark:border-white/65 dark:bg-gradient-to-br dark:from-white/[0.22] dark:via-slate-100/[0.10] dark:to-cyan-100/[0.05] dark:text-white dark:shadow-[inset_1px_1px_0_rgba(255,255,255,0.85),inset_-1px_-1px_0_rgba(186,230,253,0.14),0_0_30px_rgba(224,242,254,0.12),0_28px_70px_-32px_rgba(0,0,0,0.9)] dark:ring-1 dark:ring-cyan-100/20 dark:backdrop-blur-2xl dark:saturate-150 before:pointer-events-none before:absolute before:-bottom-40 before:-right-28 before:-z-10 before:h-96 before:w-96 before:rounded-full before:bg-primary/10 before:blur-[90px] dark:before:bg-primary/35 sm:p-7 lg:p-9">
        <div className="mb-10 flex items-center justify-between">
          <Link
            to={backTo}
            className="rounded-full border border-border bg-muted/40 px-5 py-2.5 font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary dark:border-white/20 dark:bg-card/[0.08] dark:text-white/80 dark:backdrop-blur dark:hover:border-red-300/60 dark:hover:bg-primary/20 dark:hover:text-white"
          >
            بازگشت
          </Link>

          <div className="flex items-center gap-4">
            {isBank && (
              <img
                src={assetUrl(bankLogo)}
                alt="بانک ملت"
                className="h-14 object-contain"
              />
            )}
            <h2 className="text-3xl font-bold text-foreground dark:text-white">{pageTitle}</h2>
          </div>
        </div>

        {groupedChildren.length > 0 && (
          <section className={department?.sections.length ? "mb-10" : ""}>
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-muted-foreground dark:text-white/60">
              <Building2 className="h-4 w-4 text-red-500" />
              زیرمجموعه‌های این واحد
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {groupedChildren.map((child) => {
                const Icon = childIcon[child.id] || Building2;
                return (
                  <Link key={child.id} to={childLink(child)}>
                    <Card className={cn("group relative isolate h-full overflow-hidden", surfaceCard, "before:absolute before:-bottom-12 before:-left-8 before:-z-10 before:h-28 before:w-28 before:rounded-full before:bg-primary/10 before:blur-3xl dark:before:bg-primary/25")}>
                      <CardContent className="flex items-center gap-4 p-6">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary dark:border-white/40 dark:bg-gradient-to-br dark:from-white/25 dark:via-red-400/20 dark:to-red-600/35 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_0_24px_rgba(248,113,113,0.5)]">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-foreground dark:text-white">{child.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground dark:text-white/50">
                            {child.id === "contract-archive"
                              ? "مشاهده آرشیو قراردادها"
                              : `${child.sections.length.toLocaleString("fa-IR")} خدمت`}
                          </p>
                        </div>
                        <ChevronLeft className="h-5 w-5 text-red-400 transition-transform group-hover:-translate-x-1 dark:text-red-300" />
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
              <Card className="rounded-3xl border border-primary/20 bg-primary/10 shadow-sm transition hover:-translate-y-1 hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_18px_42px_-20px_rgba(239,68,68,0.45)] dark:backdrop-blur-xl dark:hover:bg-primary/15 dark:hover:shadow-[0_22px_44px_-18px_rgba(239,68,68,0.55)]">
                <CardContent className="p-6 text-right">
                  <h3 className="text-lg font-bold text-foreground dark:text-white">
                    مشاهده آخرین گزارش ثبت‌شده
                  </h3>
                  <p className="mt-2 text-sm text-primary dark:text-red-200">
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
              <Card className={cn("h-full cursor-pointer", surfaceCard, "dark:hover:shadow-[0_26px_50px_-18px_rgba(239,68,68,0.42)]")}>
                <CardContent className="p-8 text-right">
                  {isBank && (
                    <img
                      src={assetUrl(bankLogo)}
                      alt="بانک ملت"
                      className="mb-4 h-10 object-contain"
                    />
                  )}
                  <h3 className="text-xl font-bold text-foreground dark:text-white">{s.title}</h3>
                  <p className="mt-3 text-sm text-primary dark:text-red-200">ورود به فرم</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
