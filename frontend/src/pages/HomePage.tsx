import { ComponentType, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
  GraduationCap,
  Landmark,
  Megaphone,
  Monitor,
  ScrollText,
} from "lucide-react";

import client from "../api/client";
import { endpoints } from "../api/endpoints";
import AppShell from "../components/layout/AppShell";
import { Card, CardContent } from "../components/ui/card";
import { API_BASE, Department } from "../config/portal";
import { SiteBanner } from "../features/banner";

type HomeCard = {
  id: string;
  title: string;
  description: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  departmentIds?: string[];
};

const HOME_CARDS: HomeCard[] = [
  {
    id: "guidelines",
    title: "دستورالعمل",
    description: "آیین‌نامه‌ها و دستورالعمل‌ها",
    icon: ScrollText,
  },
  {
    id: "training",
    title: "آموزش",
    description: "محتوای آموزشی سامانه",
    icon: GraduationCap,
  },
  {
    id: "forms",
    title: "فرم",
    description: "فرم‌های عمومی سازمان",
    icon: ClipboardCheck,
  },
  {
    id: "documents",
    title: "مستندات",
    description: "اسناد و مستندات",
    icon: FolderOpen,
  },
  {
    id: "it",
    title: "معاونت فناوری اطلاعات",
    description: "خدمات و پشتیبانی فناوری",
    href: "/departments/it",
    icon: Monitor,
    departmentIds: ["it"],
  },
  {
    id: "business",
    title: "معاونت کسب و کار",
    description: "خدمات کسب و کار و بانک",
    href: "/departments/business",
    icon: BriefcaseBusiness,
    departmentIds: ["business", "bank"],
  },
  {
    id: "resource-development",
    title: "معاونت توسعه منابع",
    description: "منابع انسانی و امور مالی",
    href: "/departments/resource-development",
    icon: Building2,
    departmentIds: ["hr", "finance"],
  },
  {
    id: "planning",
    title: "مدیریت طرح و توسعه",
    description: "طرح‌ها، فرایندها و توسعه",
    href: "/departments/planning",
    icon: Landmark,
    departmentIds: ["planning"],
  },
  {
    id: "reports",
    title: "گزارشات",
    description: "ثبت و مشاهده گزارشات",
    href: "/departments/reports",
    icon: BarChart3,
    departmentIds: ["reports"],
  },
  {
    id: "contracts",
    title: "امور قراردادها",
    description: "قراردادها و آرشیو قراردادها",
    href: "/departments/contracts",
    icon: FileText,
    departmentIds: ["contracts", "contract-archive"],
  },
  {
    id: "timesheet",
    title: "تایم شیت",
    description: "ثبت و مدیریت کارکرد",
    href: "/timesheet",
    icon: Clock3,
  },
];

function DestinationCard({ card }: { card: HomeCard }) {
  const Icon = card.icon;
  const content = (
    <Card
      className={`group h-full overflow-hidden rounded-3xl transition-all duration-300 ${
        card.href
          ? "border-0 bg-white/90 shadow-lg backdrop-blur hover:-translate-y-2 hover:shadow-2xl"
          : "border border-dashed border-slate-200 bg-white/60 shadow-sm"
      }`}
    >
      <CardContent className="relative flex h-full min-h-56 flex-col items-center justify-center p-8 text-center">
        {!card.href && (
          <span className="absolute left-4 top-4 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
            به‌زودی
          </span>
        )}

        <div
          className={`mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition ${
            card.href
              ? "bg-red-50 text-red-600 group-hover:scale-110"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          <Icon className="h-8 w-8" />
        </div>

        <h3 className="text-xl font-bold leading-8 text-slate-900">
          {card.title}
        </h3>
        <div className="mt-3 flex items-center justify-center gap-1 text-sm text-red-500">
          <span className={card.href ? "" : "text-slate-400"}>
            {card.description}
          </span>
          {card.href && (
            <ChevronLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-1" />
          )}
        </div>
      </CardContent>
    </Card>
  );

  return card.href ? (
    <Link to={card.href} className="block h-full">
      {content}
    </Link>
  ) : (
    <div aria-disabled="true" className="h-full">
      {content}
    </div>
  );
}

export default function HomePage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [banner, setBanner] = useState<SiteBanner | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    fetch(`${API_BASE}/departments`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then(setDepartments)
      .catch(() => setDepartments([]));

    client
      .get<SiteBanner>(endpoints.banner)
      .then(({ data }) => setBanner(data))
      .catch(() => setBanner(null));
  }, []);

  const visibleDepartmentIds = useMemo(
    () => new Set(departments.map((department) => department.id)),
    [departments],
  );

  const cards = HOME_CARDS.map((card) => {
    if (!card.departmentIds) return card;
    const isAvailable = card.departmentIds.some((id) => visibleDepartmentIds.has(id));
    return isAvailable ? card : { ...card, href: undefined };
  });

  return (
    <AppShell>
      {banner?.is_active && banner.image_url && (
        <section className="mb-10 overflow-hidden rounded-3xl bg-slate-900 shadow-xl shadow-slate-900/15">
          <img
            src={banner.image_url}
            alt={banner.image_name || "بنر صفحه اصلی"}
            className="aspect-[4/3] w-full object-cover sm:aspect-[16/7]"
          />
        </section>
      )}

      <div
        dir="ltr"
        className="grid items-start gap-8 xl:grid-cols-[19rem_minmax(0,1fr)]"
      >
        <aside
          dir="rtl"
          className="order-2 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg shadow-slate-900/5 xl:order-1 xl:sticky xl:top-8"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">آخرین اخبار</h2>
              <p className="mt-1 text-xs text-slate-400">تازه‌ترین اطلاعیه‌های سازمان</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Megaphone className="h-5 w-5" />
            </div>
          </div>

          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <BookOpen className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-600">
              خبری منتشر نشده است
            </p>
            <p className="mt-1 text-xs leading-6 text-slate-400">
              تازه‌ترین اطلاعیه‌ها در این بخش نمایش داده می‌شوند.
            </p>
          </div>
        </aside>

        <section dir="rtl" aria-label="خدمات سازمان" className="order-1 xl:order-2">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <DestinationCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
