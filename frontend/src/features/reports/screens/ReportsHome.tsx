import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function ReportsHome() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">

        <Link
          href="/"
          className="text-primary font-semibold"
        >
          بازگشت
        </Link>

        <h1 className="text-4xl font-bold mt-8">
          گزارشات
        </h1>

        <p className="text-muted-foreground mt-2">
          گزارشات مدیریتی سامانه
        </p>

        <div className="grid md:grid-cols-3 gap-6 mt-10">

          <Link href="/departments/reports">

            <Card className="rounded-3xl hover:shadow-xl transition">

              <CardContent className="p-8">

                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">

                  <BarChart3
                    className="text-primary"
                    size={34}
                  />

                </div>

                <h2 className="text-xl font-bold mt-6">

                  ثبت گزارش جدید

                </h2>

                <p className="text-muted-foreground mt-2">

                  تکمیل فرم گزارش عملکرد

                </p>

              </CardContent>

            </Card>

          </Link>

          <Link href="/reports/performance">

            <Card className="rounded-3xl hover:shadow-xl transition">

              <CardContent className="p-8">

                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">

                  <BarChart3
                    className="text-primary"
                    size={34}
                  />

                </div>

                <h2 className="text-xl font-bold mt-6">

                  گزارش عملکرد شورای معاونین و مدیران

                </h2>

                <p className="text-muted-foreground mt-2">

                  مشاهده آخرین گزارش ثبت‌شده

                </p>

              </CardContent>

            </Card>

          </Link>

        </div>

      </div>
    </AppShell>
  );
}