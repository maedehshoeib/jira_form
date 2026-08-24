import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
  GraduationCap,
  Landmark,
  LucideIcon,
  Mail,
  Megaphone,
  Monitor,
  Network,
  X,
} from "lucide-react";

import client from "../api/client";
import { endpoints } from "../api/endpoints";
import AppShell from "../components/layout/AppShell";
import { Card, CardContent } from "../components/ui/card";
import { API_BASE, Department } from "../config/portal";
import { SiteBanner } from "../features/banner";
import { SiteNews } from "../features/news";
import { formatPersianDateTime } from "../lib/persianDate";
import { cn } from "../lib/utils";
import { LETTER_WORKFLOWS } from "./management/letterWorkflow";

type HomeCard = {
  id: string;
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
  departmentIds?: string[];
  featured?: boolean;
};

const HOME_CARDS: HomeCard[] = [
  {
    id: "meeting-room",
    title: "رزرو اتاق جلسات",
    description: "ثبت و پیگیری درخواست رزرو اتاق جلسه",
    href: "/forms/meeting-room-reservation-form?department=meeting-room&section=meeting-room-reservation",
    icon: CalendarDays,
    departmentIds: ["meeting-room"],
    featured: true,
  },
  {
    id: "internal-letters",
    title: LETTER_WORKFLOWS.internal.title,
    description: LETTER_WORKFLOWS.internal.description,
    href: LETTER_WORKFLOWS.internal.homePath,
    icon: Mail,
    departmentIds: [LETTER_WORKFLOWS.internal.accessDepartmentId],
    featured: true,
  },
  {
    id: "guidelines",
    title: "دستورالعمل",
    description: "آیین‌نامه‌ها و دستورالعمل‌ها",
    href: "/guidelines",
    icon: FileText,
  },
  {
    id: "training",
    title: "آموزش",
    description: "محتوای آموزشی سامانه",
    href: "/training",
    icon: GraduationCap,
  },
  {
    id: "forms",
    title: "فرم",
    description: "فرم‌های عمومی سازمان",
    href: "/pdf-forms",
    icon: ClipboardCheck,
  },
  {
    id: "documents",
    title: "مستندات",
    description: "اسناد و مستندات",
    href: "/documents",
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
    title: "گزارش شورای معاونین و مدیران",
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
  {
    id: "external-letters",
    title: LETTER_WORKFLOWS.external.title,
    description: LETTER_WORKFLOWS.external.description,
    href: LETTER_WORKFLOWS.external.homePath,
    icon: Network,
    departmentIds: [LETTER_WORKFLOWS.external.accessDepartmentId],
  },
];

const HOME_CARD_ROWS = [
  ["internal-letters", "timesheet", "external-letters"],
  ["guidelines", "training", "forms", "documents"],
  ["business", "it", "resource-development", "planning"],
  ["reports", "contracts", "meeting-room"],
] as const;

const HOME_ICON_STYLES: Record<string, string> = {
  "meeting-room": "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/40 dark:bg-teal-500/20 dark:text-teal-200",
  guidelines: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-500/20 dark:text-cyan-200",
  training: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-200",
  forms: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-500/20 dark:text-red-200",
  documents: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-400/40 dark:bg-purple-500/20 dark:text-purple-200",
  it: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-200",
  business: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/20 dark:text-violet-200",
  "resource-development": "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/40 dark:bg-orange-500/20 dark:text-orange-200",
  planning: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/20 dark:text-rose-200",
  reports: "border-green-200 bg-green-50 text-green-700 dark:border-green-400/40 dark:bg-green-500/20 dark:text-green-200",
  contracts: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/40 dark:bg-orange-500/20 dark:text-orange-200",
  timesheet: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-200",
  "external-letters": "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-500/20 dark:text-indigo-200",
  "internal-letters": "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-500/20 dark:text-indigo-200",
};

const formatNewsDate = (value: string) => formatPersianDateTime(value);

function NewsDetailModal({
  news,
  onClose,
}: {
  news: SiteNews;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
      <button
        type="button"
        aria-label="بستن"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm dark:bg-slate-950/60"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="news-detail-title"
        className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/20 dark:bg-slate-950/95 dark:ring-1 dark:ring-white/10"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h2
              id="news-detail-title"
              className="text-lg font-extrabold leading-8 text-slate-900 dark:text-white"
            >
              {news.title}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-white/45">
              تاریخ انتشار: {formatNewsDate(news.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="بستن جزئیات خبر"
          >
            <X size={20} />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5">
          {news.image_url && (
            <img
              src={news.image_url}
              alt={news.title}
              className="mb-5 max-h-[28rem] w-full rounded-2xl bg-slate-100 object-contain dark:bg-black/30"
            />
          )}
          {news.body ? (
            <p className="whitespace-pre-wrap text-sm leading-8 text-slate-700 dark:text-white/80">
              {news.body}
            </p>
          ) : (
            !news.image_url && (
              <p className="text-sm text-slate-400 dark:text-white/45">جزئیات بیشتری ثبت نشده است.</p>
            )
          )}
        </div>
      </section>
    </div>
  );
}

function DestinationCard({ card }: { card: HomeCard }) {
  const Icon = card.icon;
  const isFeatured = card.featured && Boolean(card.href);
  const content = (
    <Card
      className={cn(
        "group relative isolate h-full overflow-hidden rounded-[1.75rem] border transition-all duration-500",
        card.href
          ? isFeatured
            ? "border-indigo-200/90 bg-gradient-to-br from-indigo-50 via-white to-sky-50 shadow-[0_12px_32px_-20px_rgba(79,70,229,0.55)] hover:-translate-y-2 hover:border-indigo-300 hover:shadow-[0_18px_38px_-20px_rgba(79,70,229,0.65)] focus-within:-translate-y-1 dark:border-indigo-300/45 dark:from-indigo-950/80 dark:via-slate-800 dark:to-sky-950/60 dark:shadow-[0_16px_36px_-20px_rgba(129,140,248,0.5)] dark:hover:border-indigo-300/70"
            : "border-slate-200 bg-white shadow-sm hover:-translate-y-2 hover:border-red-200 hover:shadow-lg hover:shadow-red-100/60 focus-within:-translate-y-1 dark:border-slate-600 dark:bg-slate-800/90 dark:shadow-lg dark:shadow-black/30 dark:hover:border-red-400/50 dark:hover:bg-slate-800 dark:hover:shadow-red-950/40"
          : "border-dashed border-slate-300 bg-slate-50 shadow-none dark:border-slate-600 dark:bg-slate-800/50",
      )}
    >
      {isFeatured && (
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent" />
      )}
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full blur-3xl transition-all duration-500",
          isFeatured
            ? "bg-indigo-500/20 group-hover:bg-indigo-400/30 dark:bg-indigo-400/20 dark:group-hover:bg-indigo-300/30"
            : "bg-red-500/10 group-hover:bg-red-400/20 dark:bg-red-500/15 dark:group-hover:bg-red-400/25",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute -bottom-16 -left-12 h-36 w-36 rounded-full blur-3xl",
          isFeatured
            ? "bg-sky-300/25 dark:bg-sky-300/10"
            : "bg-rose-300/10 dark:bg-rose-300/5",
        )}
      />
      <CardContent className="relative flex h-full min-h-56 flex-col items-center justify-center p-7 text-center sm:p-8">
        {isFeatured && (
          <span className="absolute right-4 top-4 rounded-full border border-indigo-200/80 bg-white/75 px-2.5 py-1 text-[11px] font-bold text-indigo-700 shadow-sm backdrop-blur dark:border-indigo-300/30 dark:bg-indigo-300/10 dark:text-indigo-200">
            دسترسی سریع
          </span>
        )}
        {!card.href && (
          <span className="absolute left-4 top-4 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:border-white/20 dark:bg-black/20 dark:text-white/50 dark:backdrop-blur-md">
            به‌زودی
          </span>
        )}

        <div
          className={cn(
            "relative z-10 mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition-transform duration-500",
            card.href
              ? cn(HOME_ICON_STYLES[card.id], "group-hover:scale-110 group-hover:-rotate-3")
              : "border-slate-200 bg-slate-100 text-slate-400 dark:border-white/20 dark:bg-white/10 dark:text-white/40",
          )}
        >
          <Icon className="h-8 w-8 shrink-0" strokeWidth={2} />
        </div>

        <h3
          className={cn(
            "text-xl font-bold leading-8",
            isFeatured
              ? "text-indigo-950 dark:text-indigo-50"
              : "text-slate-900 dark:text-white",
          )}
        >
          {card.title}
        </h3>
        <div className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-red-600 dark:text-red-200">
          <span className={card.href ? "text-slate-500 dark:text-white/70" : "text-slate-400 dark:text-white/35"}>
            {card.description}
          </span>
          {card.href && (
            <ChevronLeft
              className={cn(
                "absolute bottom-4 left-4 h-9 w-9 shrink-0 rounded-full border p-2 transition-all group-hover:-translate-x-1 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_14px_rgba(255,255,255,0.08)] dark:backdrop-blur",
                isFeatured
                  ? "border-indigo-200 bg-white/80 text-indigo-600 group-hover:border-indigo-300 group-hover:bg-indigo-100 dark:border-indigo-300/30 dark:bg-indigo-300/10 dark:text-indigo-100 dark:group-hover:border-indigo-200/60 dark:group-hover:bg-indigo-300/20"
                  : "border-slate-200 bg-slate-50 text-slate-500 group-hover:border-red-200 group-hover:bg-red-50 group-hover:text-red-600 dark:border-white/25 dark:bg-white/10 dark:text-white/80 dark:group-hover:border-red-200/60 dark:group-hover:bg-red-400/20 dark:group-hover:text-white/80",
              )}
            />
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
  const [newsItems, setNewsItems] = useState<SiteNews[]>([]);
  const [selectedNews, setSelectedNews] = useState<SiteNews | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

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

    client
      .get<SiteNews[]>(endpoints.news)
      .then(({ data }) => setNewsItems(data))
      .catch(() => setNewsItems([]));
  }, []);

  useEffect(() => {
    setActiveSlide(0);
  }, [banner?.images.length]);

  useEffect(() => {
    const imageCount = banner?.images.length ?? 0;
    if (imageCount < 2 || isCarouselPaused) return;

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % imageCount);
    }, (banner?.interval_seconds ?? 5) * 1000);

    return () => window.clearInterval(timer);
  }, [banner?.images.length, banner?.interval_seconds, isCarouselPaused]);

  const visibleDepartmentIds = useMemo(
    () => new Set(departments.map((department) => department.id)),
    [departments],
  );

  const cards = HOME_CARDS.map((card) => {
    if (!card.departmentIds) return card;
    const isAvailable = card.departmentIds.some((id) => visibleDepartmentIds.has(id));
    return isAvailable ? card : { ...card, href: undefined };
  }).filter((card) => {
    // Restricted admin card: hide completely when the user has no access.
    const isRestrictedLetterCard = card.departmentIds?.some(
      (id) =>
        id === LETTER_WORKFLOWS.external.accessDepartmentId ||
        id === LETTER_WORKFLOWS.internal.accessDepartmentId,
    );
    if (isRestrictedLetterCard && !card.href) return false;
    return true;
  });

  const cardRows = HOME_CARD_ROWS.map((row) =>
    row
      .map((cardId) => cards.find((card) => card.id === cardId))
      .filter((card): card is HomeCard => Boolean(card)),
  ).filter((row) => row.length > 0);

  return (
    <AppShell>
      {banner?.is_active && banner.images.length > 0 && (
        <section
          aria-label="بنرهای صفحه اصلی"
          aria-roledescription="carousel"
          className="group relative mb-6 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-900 shadow-[0_16px_50px_-24px_rgba(15,23,42,0.55)] ring-1 ring-slate-900/5 dark:border-white/60"
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
          onFocus={() => setIsCarouselPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsCarouselPaused(false);
            }
          }}
        >
          <div className="relative aspect-[16/9] w-full max-h-[calc(14rem+5cm)] sm:max-h-[calc(18rem+5cm)] sm:aspect-[16/7]">
            {banner.images.map((image, index) => (
              <img
                key={image.id}
                src={image.image_url}
                alt={image.image_name || `بنر ${index + 1} صفحه اصلی`}
                aria-hidden={index !== activeSlide}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  index === activeSlide ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              />
            ))}
          </div>

          {banner.images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="تصویر قبلی"
                onClick={() =>
                  setActiveSlide(
                    (current) =>
                      (current - 1 + banner.images.length) % banner.images.length,
                  )
                }
                className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur transition hover:bg-black/55 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white group-hover:opacity-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="تصویر بعدی"
                onClick={() =>
                  setActiveSlide((current) => (current + 1) % banner.images.length)
                }
                className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur transition hover:bg-black/55 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white group-hover:opacity-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/30 px-3 py-2 backdrop-blur">
                {banner.images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    aria-label={`نمایش بنر ${index + 1}`}
                    aria-current={index === activeSlide}
                    onClick={() => setActiveSlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === activeSlide ? "w-6 bg-white" : "w-2 bg-white/55"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <div
        dir="ltr"
        className="grid items-start gap-8 xl:grid-cols-[19rem_minmax(0,1fr)]"
      >
        <aside
          dir="rtl"
          className="order-2 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-white/65 dark:bg-gradient-to-br dark:from-white/[0.22] dark:via-slate-100/[0.10] dark:to-cyan-100/[0.05] dark:shadow-[inset_1px_1px_0_rgba(255,255,255,0.82),inset_-1px_-1px_0_rgba(186,230,253,0.12),0_0_28px_rgba(224,242,254,0.1),0_24px_55px_-26px_rgba(0,0,0,0.8)] dark:ring-1 dark:ring-cyan-100/20 dark:backdrop-blur-2xl dark:saturate-150 xl:order-1 xl:sticky xl:top-8"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-5 dark:border-white/15 dark:bg-white/[0.04]">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">آخرین اخبار</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-white/45">تازه‌ترین اطلاعیه‌های سازمان</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-600 shadow-sm dark:border-red-200/40 dark:bg-red-500/15 dark:text-red-300 dark:shadow-[0_0_22px_rgba(248,113,113,0.25)] dark:backdrop-blur">
              <Megaphone className="h-5 w-5" />
            </div>
          </div>

          {newsItems.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 shadow-sm dark:border-white/20 dark:bg-white/[0.08] dark:text-white/35 dark:backdrop-blur">
                <BookOpen className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-bold text-slate-600 dark:text-white/70">
                خبری منتشر نشده است
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-400 dark:text-white/40">
                تازه‌ترین اطلاعیه‌ها در این بخش نمایش داده می‌شوند.
              </p>
            </div>
          ) : (
            <ul className="max-h-[36rem] divide-y divide-slate-100 overflow-y-auto dark:divide-white/10">
              {newsItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedNews(item)}
                    className="flex w-full gap-3 px-4 py-4 text-right transition hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100 dark:hover:bg-white/[0.06] dark:focus-visible:bg-white/[0.08]"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/15"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-red-50 text-red-500 dark:border-white/15 dark:bg-white/[0.06] dark:text-red-300/80">
                        <Megaphone className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-bold leading-6 text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      {item.body && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-white/45">
                          {item.body}
                        </p>
                      )}
                      <p className="mt-2 text-[11px] text-slate-400 dark:text-white/35">
                        {formatNewsDate(item.created_at)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section dir="rtl" aria-label="خدمات سازمان" className="order-1 xl:order-2">
          <div className="space-y-8">
            {cardRows.map((row, rowIndex) => (
              <div
                key={HOME_CARD_ROWS[rowIndex].join("-")}
                className={cn(
                  "grid gap-8 sm:grid-cols-2",
                  HOME_CARD_ROWS[rowIndex].length === 3
                    ? "lg:grid-cols-3"
                    : "lg:grid-cols-4",
                )}
              >
                {row.map((card) => (
                  <DestinationCard key={card.id} card={card} />
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      {selectedNews && (
        <NewsDetailModal
          news={selectedNews}
          onClose={() => setSelectedNews(null)}
        />
      )}
    </AppShell>
  );
}
