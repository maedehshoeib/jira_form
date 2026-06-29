import { Search } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export default function ReportFilters() {
  return (
    <Card className="mt-8 rounded-3xl border-0 shadow-md">
      <CardContent className="p-6">

        <div className="grid gap-5 lg:grid-cols-5">

          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-medium">
              جستجو
            </label>

            <div className="relative">

              <Search
                className="absolute left-3 top-3 h-5 w-5 text-slate-400"
              />

              <Input
                placeholder="عنوان گزارش..."
                className="pl-10 h-11 rounded-xl"
              />

            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              واحد
            </label>

            <Select>

              <SelectTrigger className="h-11 rounded-xl">

                <SelectValue placeholder="همه واحدها" />

              </SelectTrigger>

              <SelectContent>

                <SelectItem value="all">
                  همه واحدها
                </SelectItem>

                <SelectItem value="it">
                  فناوری اطلاعات
                </SelectItem>

                <SelectItem value="hr">
                  منابع انسانی
                </SelectItem>

                <SelectItem value="finance">
                  مالی
                </SelectItem>

              </SelectContent>

            </Select>

          </div>

          <div>

            <label className="mb-2 block text-sm font-medium">

              وضعیت

            </label>

            <Select>

              <SelectTrigger className="h-11 rounded-xl">

                <SelectValue placeholder="همه" />

              </SelectTrigger>

              <SelectContent>

                <SelectItem value="all">
                  همه
                </SelectItem>

                <SelectItem value="completed">
                  تکمیل شده
                </SelectItem>

                <SelectItem value="pending">
                  در انتظار
                </SelectItem>

              </SelectContent>

            </Select>

          </div>

          <div className="flex items-end">

            <Button
              className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700"
            >
              جستجو
            </Button>

          </div>

        </div>

      </CardContent>
    </Card>
  );
}