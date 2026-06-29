import { Card, CardContent } from "../ui/card";
import {
  FileText,
  Clock3,
  CircleCheckBig,
  Building2,
} from "lucide-react";

const stats = [
  {
    title: "کل گزارشات",
    value: 24,
    icon: FileText,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    title: "در انتظار بررسی",
    value: 7,
    icon: Clock3,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    title: "تکمیل شده",
    value: 17,
    icon: CircleCheckBig,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    title: "واحد فعال",
    value: 9,
    icon: Building2,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
];

export default function ReportStats() {
  return (
    <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">

      {stats.map((item) => {

        const Icon = item.icon;

        return (

          <Card
            key={item.title}
            className="
              rounded-3xl
              border-0
              shadow-md
              hover:shadow-xl
              transition-all
              duration-300
            "
          >

            <CardContent className="p-6">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-slate-500 text-sm">
                    {item.title}
                  </p>

                  <h2 className="mt-3 text-4xl font-bold">
                    {item.value}
                  </h2>

                </div>

                <div
                  className={`
                    w-16
                    h-16
                    rounded-2xl
                    flex
                    items-center
                    justify-center
                    ${item.bg}
                  `}
                >

                  <Icon
                    size={32}
                    className={item.color}
                  />

                </div>

              </div>

            </CardContent>

          </Card>

        );

      })}

    </div>
  );
}