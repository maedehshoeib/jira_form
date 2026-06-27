import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AppShell from "../components/layout/AppShell";
import { API_BASE, Department } from "../config/portal";

import { Card, CardContent } from "../components/ui/card";

import {
  Wallet,
  Monitor,
  Users,
  Briefcase,
  Landmark,
  FileText,
  Building2,
} from "lucide-react";

export default function HomePage() {
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/departments`)
      .then((res) => res.json())
      .then(setDepartments);
  }, []);

  const getDepartmentIcon = (title: string) => {
    if (title.includes("مالی"))
      return <Wallet className="h-8 w-8" />;

    if (title.includes("فناوری"))
      return <Monitor className="h-8 w-8" />;

    if (title.includes("منابع"))
      return <Users className="h-8 w-8" />;

    if (title.includes("کسب"))
      return <Briefcase className="h-8 w-8" />;

    if (title.includes("بانک"))
      return <Landmark className="h-8 w-8" />;

    if (title.includes("قرارداد"))
      return <FileText className="h-8 w-8" />;

    return <Building2 className="h-8 w-8" />;
  };

  return (
    <AppShell>
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
          <Link key={d.id} to={`/departments/${d.id}`}>
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
                  {getDepartmentIcon(d.title)}
                </div>

                <h3 className="text-xl font-bold text-slate-900">
                  {d.title}
                </h3>

                <p className="mt-3 text-sm text-red-500">
                  {d.sections.length} زیرمجموعه
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}