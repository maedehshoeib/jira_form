import { ComponentType, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
  GraduationCap,
  Landmark,
  Megaphone,
  Monitor,
  X,
} from "lucide-react";

import client from "../api/client";
import { endpoints } from "../api/endpoints";
import AppShell from "../components/layout/AppShell";
import { Card, CardContent } from "../components/ui/card";
import { API_BASE, Department } from "../config/portal";
import { SiteBanner } from "../features/banner";
import { SiteNews } from "../features/news";

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
    icon: FileText,
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
    href: "/pdf-forms",
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

const HOME_ICON_STYLES: Record<string, string> = {
  guidelines: "border-cyan-200/60 from-white/30 via-cyan-300/20 to-cyan-500/35 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_28px_rgba(34,211,238,0.6)]",
  training: "border-blue-200/60 from-white/30 via-blue-300/20 to-blue-600/35 text-blue-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_28px_rgba(59,130,246,0.65)]",
  forms: "border-red-200/60 from-white/30 via-red-300/20 to-red-600/40 text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_28px_rgba(248,113,113,0.7)]",
  documents: "border-purple-200/60 from-white/30 via-purple-300/20 to-purple-600/40 text-purple-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_28px_rgba(192,132,252,0.7)]",
  it: "border-emerald-200/60 from-white/30 via-emerald-300/20 to-emerald-600/40 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_28px_rgba(74,222,128,0.65)]",
  business: "border-violet-200/60 from-white/30 via-violet-300/20 to-violet-600/40 text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_28px_rgba(167,139,250,0.65)]",
  "resource-development": "border-orange-200/60 from-white/30 via-orange-300/20 to-orange-600/40 text-orange-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_28px_rgba(251,146,60,0.7)]",
  planning: "border-rose-200/60 from-white/30 via-rose-300/20 to-rose-600/40 text-rose-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_28px_rgba(251,113,133,0.7)]",
  reports: "border-green-200/60 from-white/30 via-green-300/20 to-green-600/40 text-green-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_28px_rgba(74,222,128,0.65)]",
  contracts: "border-orange-200/60 from-white/30 via-orange-300/20 to-orange-600/40 text-orange-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_28px_rgba(251,146,60,0.7)]",
  timesheet: "border-blue-200/60 from-white/30 via-blue-300/20 to-blue-600/40 text-blue-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_28px_rgba(59,130,246,0.7)]",
};

const formatNewsDate = (value: string) =>
  new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

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
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="news-detail-title"
        className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-slate-950/95 shadow-2xl ring-1 ring-white/10"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="news-detail-title"
              className="text-lg font-extrabold leading-8 text-white"
            >
              {news.title}
            </h2>
            <p className="mt-1 text-xs text-white/45">
              تاریخ انتشار: {formatNewsDate(news.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
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
              className="mb-5 max-h-[28rem] w-full rounded-2xl object-contain bg-black/30"
            />
          )}
          {news.body ? (
            <p className="whitespace-pre-wrap text-sm leading-8 text-white/80">
              {news.body}
            </p>
          ) : (
            !news.image_url && (
              <p className="text-sm text-white/45">جزئیات بیشتری ثبت نشده است.</p>
            )
          )}
        </div>
      </section>
    </div>
  );
}

function DestinationCard({ card }: { card: HomeCard }) {
  const Icon = card.icon;
  const content = (
    <Card
      className={`group relative isolate h-full overflow-hidden rounded-[1.75rem] border backdrop-blur-2xl transition-all duration-500 before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent after:pointer-events-none after:absolute after:left-3 after:top-5 after:h-20 after:w-px after:bg-gradient-to-b after:from-white/70 after:to-transparent ${
        card.href
          ? "border-white/65 bg-gradient-to-br from-white/[0.24] via-slate-100/[0.11] to-cyan-100/[0.06] shadow-[inset_1px_1px_0_rgba(255,255,255,0.85),inset_-1px_-1px_0_rgba(186,230,253,0.15),0_0_28px_rgba(224,242,254,0.12),0_24px_55px_-24px_rgba(0,0,0,0.78)] ring-1 ring-cyan-100/20 saturate-150 hover:-translate-y-2 hover:border-red-200/70 hover:bg-white/[0.22] hover:shadow-[0_24px_55px_-20px_rgba(239,68,68,0.38)] focus-within:-translate-y-1"
          : "border-dashed border-white/35 bg-gradient-to-br from-white/[0.12] to-cyan-100/[0.04] shadow-[inset_1px_1px_0_rgba(255,255,255,0.4),0_18px_45px_-28px_rgba(0,0,0,0.7)] saturate-[.85]"
      }`}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-red-500/30 blur-3xl transition-all duration-500 group-hover:bg-red-400/50" />
      <div className="pointer-events-none absolute -bottom-16 -left-12 h-36 w-36 rounded-full bg-rose-300/10 blur-3xl" />
      <CardContent className="relative flex h-full min-h-56 flex-col items-center justify-center p-7 text-center sm:p-8">
        {!card.href && (
          <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[11px] font-bold text-white/50 backdrop-blur-md">
            به‌زودی
          </span>
        )}

        <div
          className={`mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_28px_-16px_rgba(185,28,28,0.5)] backdrop-blur-md transition-all duration-500 ${
            card.href
              ? `bg-gradient-to-br ${HOME_ICON_STYLES[card.id]} group-hover:scale-110 group-hover:-rotate-3`
              : "border-white/20 bg-white/10 text-white/40"
          }`}
        >
          <Icon className="h-8 w-8" />
        </div>

        <h3 className="text-xl font-bold leading-8 text-white">
          {card.title}
        </h3>
        <div className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-red-200">
          <span className={card.href ? "text-white/70" : "text-white/35"}>
            {card.description}
          </span>
          {card.href && (
            <ChevronLeft className="absolute bottom-4 left-4 h-9 w-9 shrink-0 rounded-full border border-white/25 bg-white/10 p-2 text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_14px_rgba(255,255,255,0.08)] backdrop-blur transition-all group-hover:-translate-x-1 group-hover:border-red-200/60 group-hover:bg-red-400/20" />
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
  });

  return (
    <AppShell>
      {banner?.is_active && banner.images.length > 0 && (
        <section
          aria-label="بنرهای صفحه اصلی"
          aria-roledescription="carousel"
          className="group relative mb-6 overflow-hidden rounded-[1.5rem] border border-white/60 bg-slate-900 shadow-[0_16px_50px_-24px_rgba(15,23,42,0.55)] ring-1 ring-slate-900/5"
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
          className="order-2 overflow-hidden rounded-[1.75rem] border border-white/65 bg-gradient-to-br from-white/[0.22] via-slate-100/[0.10] to-cyan-100/[0.05] shadow-[inset_1px_1px_0_rgba(255,255,255,0.82),inset_-1px_-1px_0_rgba(186,230,253,0.12),0_0_28px_rgba(224,242,254,0.1),0_24px_55px_-26px_rgba(0,0,0,0.8)] ring-1 ring-cyan-100/20 backdrop-blur-2xl saturate-150 xl:order-1 xl:sticky xl:top-8"
        >
          <div className="flex items-center justify-between border-b border-white/15 bg-white/[0.04] px-5 py-5">
            <div>
              <h2 className="text-lg font-extrabold text-white">آخرین اخبار</h2>
              <p className="mt-1 text-xs text-white/45">تازه‌ترین اطلاعیه‌های سازمان</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-200/40 bg-red-500/15 text-red-300 shadow-[0_0_22px_rgba(248,113,113,0.25)] backdrop-blur">
              <Megaphone className="h-5 w-5" />
            </div>
          </div>

          {newsItems.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.08] text-white/35 shadow-sm backdrop-blur">
                <BookOpen className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-bold text-white/70">
                خبری منتشر نشده است
              </p>
              <p className="mt-1 text-xs leading-6 text-white/40">
                تازه‌ترین اطلاعیه‌ها در این بخش نمایش داده می‌شوند.
              </p>
            </div>
          ) : (
            <ul className="max-h-[36rem] divide-y divide-white/10 overflow-y-auto">
              {newsItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedNews(item)}
                    className="flex w-full gap-3 px-4 py-4 text-right transition hover:bg-white/[0.06] focus:outline-none focus-visible:bg-white/[0.08]"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-white/15"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-red-300/80">
                        <Megaphone className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-bold leading-6 text-white">
                        {item.title}
                      </h3>
                      {item.body && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">
                          {item.body}
                        </p>
                      )}
                      <p className="mt-2 text-[11px] text-white/35">
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
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <DestinationCard key={card.id} card={card} />
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
