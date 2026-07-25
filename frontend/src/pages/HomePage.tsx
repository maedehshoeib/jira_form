import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AppShell from "../components/layout/AppShell";
import client from "../api/client";
import { endpoints } from "../api/endpoints";
import { API_BASE, Department } from "../config/portal";
import { SiteBanner } from "../features/banner";
import bankLogo from "../assets/bankmellat_logo_01_s2.png";

import { Card, CardContent } from "../components/ui/card";

import {
  Wallet,
  Monitor,
  Users,
  Briefcase,
  FileText,
  Building2,
  BarChart3,
} from "lucide-react";

export default function HomePage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [banner, setBanner] = useState<SiteBanner | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    fetch(`${API_BASE}/departments`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then(setDepartments);

    client
      .get<SiteBanner>(endpoints.banner)
      .then(({ data }) => setBanner(data))
      .catch(() => setBanner(null));
  }, []);

  const getDepartmentIcon = (dept: Department) => {
    if (dept.id === "bank") {
      return (
        <img
          src={bankLogo}
          alt="بانک ملت"
          className="h-12 w-12 object-contain"
        />
      );
    }

    const title = dept.title;
    if (title.includes("مالی")) return <Wallet className="h-8 w-8" />;
    if (title.includes("فناوری")) return <Monitor className="h-8 w-8" />;
    if (title.includes("منابع")) return <Users className="h-8 w-8" />;
    if (title.includes("کسب")) return <Briefcase className="h-8 w-8" />;
    if (title.includes("قرارداد") || title.includes("ارشیو")) return <FileText className="h-8 w-8" />;
    if (title.includes("گزارش")) return <BarChart3 className="h-8 w-8" />;
    return <Building2 className="h-8 w-8" />;
  };

  const getDepartmentLink = (dept: Department) => {
    if (dept.id === "contract-archive") return "/contracts-archive";
    return `/departments/${dept.id}`;
  };

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

      <div className="mb-12 text-center">
        <h2 className="text-5xl font-extrabold text-slate-900">
          واحدهای سازمانی
        </h2>
        <p className="mt-4 text-lg text-slate-500">
          واحد مورد نظر خود را انتخاب کنید
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        {departments.map((d) => (
          <Link key={d.id} to={getDepartmentLink(d)}>
            <Card
              className="
              group
              overflow-hidden
              rounded-3xl
              border-0
              bg-white/90
              backdrop-blur
              shadow-lg
              transition-all
              duration-300
              hover:-translate-y-2
              hover:shadow-2xl
            "
            >
              <CardContent className="flex flex-col items-center p-8 text-center">
                <div
                  className="
                  mb-6
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  bg-red-50
                  text-red-600
                  transition
                  group-hover:scale-110
                "
                >
                  {getDepartmentIcon(d)}
                </div>

                <h3 className="text-xl font-bold text-slate-900">{d.title}</h3>

                <p className="mt-3 text-sm text-red-500">
                  {d.id === "reports"
                    ? "ثبت و مشاهده گزارشات"
                    : d.id === "contract-archive"
                      ? "ثبت و مشاهده آرشیو قراردادها"
                      : `${d.sections.length} زیرمجموعه`}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
