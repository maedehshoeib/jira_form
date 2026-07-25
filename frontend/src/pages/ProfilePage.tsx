import axios from "axios";
import { BriefcaseBusiness, KeyRound, Save, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import client from "../api/client";
import { endpoints } from "../api/endpoints";
import AppShell from "../components/layout/AppShell";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDisplayName(user?.display_name || "");
    setEmail(user?.email || "");
  }, [user]);

  if (!user) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { data } = await client.put(endpoints.profile, {
        display_name: displayName,
        email,
      });
      updateUser(data);
      setMessage("اطلاعات پروفایل با موفقیت ذخیره شد.");
    } catch (requestError) {
      const detail = axios.isAxiosError(requestError)
        ? requestError.response?.data?.detail
        : null;
      setError(
        typeof detail === "string"
          ? detail
          : "ذخیره اطلاعات انجام نشد. لطفاً مقادیر را بررسی کنید."
      );
    } finally {
      setLoading(false);
    }
  };

  const organizationFields = [
    ["نام کاربری", user.username],
    ["بخش", user.category],
    ["گروه / دپارتمان", user.department],
    ["سمت", user.job_title],
    ["شماره داخلی", user.extension],
  ];

  return (
    <AppShell>
      <div dir="rtl" className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900">
            <UserRound className="text-red-600" />
            پروفایل من
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            اطلاعات تماس خود را ویرایش و امنیت حساب را مدیریت کنید.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>اطلاعات قابل ویرایش</CardTitle>
            </CardHeader>
            <CardContent>
              {message && (
                <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                  {message}
                </div>
              )}
              {error && (
                <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <form onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="display-name">نام نمایشی</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">ایمیل</Label>
                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="h-11 rounded-xl text-left"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="gap-2 rounded-xl bg-red-600 hover:bg-red-700"
                >
                  <Save size={17} />
                  {loading ? "در حال ذخیره..." : "ذخیره تغییرات"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BriefcaseBusiness size={20} className="text-red-600" />
                  اطلاعات سازمانی
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {organizationFields.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                  >
                    <span className="shrink-0 text-sm text-slate-500">{label}</span>
                    <span className="text-left text-sm font-semibold text-slate-800">
                      {value || "—"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-red-100 bg-red-50/40 shadow-sm">
              <CardContent className="flex items-center justify-between gap-4 p-6">
                <div>
                  <p className="font-bold text-slate-900">امنیت حساب</p>
                  <p className="mt-1 text-sm text-slate-500">
                    رمز عبور خود را به‌صورت دوره‌ای تغییر دهید.
                  </p>
                </div>
                <Button asChild variant="outline" className="gap-2 rounded-xl bg-white">
                  <Link to="/change-password">
                    <KeyRound size={17} />
                    تغییر رمز
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
