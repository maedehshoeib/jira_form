import axios from "axios";
import { BriefcaseBusiness, Camera, KeyRound, Save, UserRound } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DateObject } from "react-multi-date-picker";
import gregorian from "react-date-object/calendars/gregorian";
import gregorianEn from "react-date-object/locales/gregorian_en";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";

import client from "../api/client";
import { endpoints } from "../api/endpoints";
import AppShell from "../components/layout/AppShell";
import UserAvatar from "../components/UserAvatar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";
import { JalaliDateTimePicker } from "../features/timesheet/components/jalali-date-time-picker";
import { toLatinDigits } from "../lib/persianDate";
import { formatUserDisplayName } from "../lib/userDisplay";
import { BirthdayBadge } from "../components/UserDisplayName";

function isoToJalali(iso: string | null | undefined): DateObject | null {
  if (!iso) return null;
  try {
    return new DateObject({
      date: toLatinDigits(iso.slice(0, 10)),
      format: "YYYY-MM-DD",
      calendar: gregorian,
      locale: gregorianEn,
    }).convert(persian, persianFa);
  } catch {
    return null;
  }
}

function jalaliToIso(value: DateObject | DateObject[] | null): string | null {
  if (!value || Array.isArray(value)) return null;
  try {
    const gregorianDate = new DateObject(value).convert(gregorian, gregorianEn);
    const year = gregorianDate.year;
    const month = String(gregorianDate.month.number).padStart(2, "0");
    const day = String(gregorianDate.day).padStart(2, "0");
    const iso = toLatinDigits(`${year}-${month}-${day}`);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  } catch {
    return null;
  }
}

function profileErrorMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const entry = item as { loc?: unknown[]; msg?: string };
        const field = Array.isArray(entry.loc)
          ? String(entry.loc[entry.loc.length - 1] || "")
          : "";
        if (field === "birth_date") return "تاریخ تولد معتبر نیست.";
        if (field === "email") return "ایمیل معتبر نیست.";
        if (field === "display_name") return "نام نمایشی معتبر نیست.";
        return entry.msg || null;
      })
      .filter(Boolean);
    if (messages.length) return messages.join(" ");
  }
  return "ذخیره اطلاعات انجام نشد. لطفاً مقادیر را بررسی کنید.";
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [birthDate, setBirthDate] = useState<DateObject | null>(() =>
    isoToJalali(user?.birth_date)
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    setDisplayName(user?.display_name || "");
    setEmail(user?.email || "");
    setBirthDate(isoToJalali(user?.birth_date));
  }, [user]);

  if (!user) return null;

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    setAvatarLoading(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const { data } = await client.post(endpoints.profileAvatar, form);
      updateUser(data);
      setMessage("تصویر پروفایل با موفقیت ذخیره شد.");
    } catch (requestError) {
      const detail = axios.isAxiosError(requestError)
        ? requestError.response?.data?.detail
        : null;
      setError(typeof detail === "string" ? detail : "بارگذاری تصویر انجام نشد.");
    } finally {
      setAvatarLoading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { data } = await client.put(endpoints.profile, {
        display_name: displayName,
        email,
        birth_date: jalaliToIso(birthDate),
      });
      updateUser(data);
      setMessage("اطلاعات پروفایل با موفقیت ذخیره شد.");
    } catch (requestError) {
      const detail = axios.isAxiosError(requestError)
        ? requestError.response?.data?.detail
        : null;
      setError(profileErrorMessage(detail));
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
          <h1 className="flex items-center gap-3 text-2xl font-extrabold text-foreground">
            <UserRound className="text-primary" />
            پروفایل من
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            اطلاعات تماس خود را ویرایش و امنیت حساب را مدیریت کنید.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border-border shadow-sm">
            <CardHeader>
              <CardTitle>اطلاعات قابل ویرایش</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex items-center gap-4 rounded-2xl bg-muted/40 p-4">
                <UserAvatar
                  name={formatUserDisplayName(user)}
                  avatarUrl={user.avatar_url}
                  className="h-20 w-20 rounded-2xl"
                />
                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">تصویر پروفایل</p>
                  <Button asChild type="button" variant="outline" className="gap-2 rounded-xl bg-card">
                    <Label className={avatarLoading ? "pointer-events-none opacity-60" : "cursor-pointer"}>
                      <Camera size={16} />
                      {avatarLoading ? "در حال بارگذاری..." : "انتخاب تصویر"}
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={uploadAvatar}
                      />
                    </Label>
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">JPG، PNG یا WebP تا ۵ مگابایت</p>
                </div>
              </div>
              {message && (
                <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                  {message}
                </div>
              )}
              {error && (
                <div className="mb-4 rounded-xl bg-primary/10 p-3 text-sm text-primary">
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
                <div className="space-y-2">
                  <Label>تاریخ تولد</Label>
                  <JalaliDateTimePicker
                    value={birthDate}
                    onChange={(value) =>
                      setBirthDate(
                        value && !Array.isArray(value) ? (value as DateObject) : null
                      )
                    }
                    placeholder="انتخاب تاریخ تولد"
                    format="YYYY/MM/DD"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      در روز تولد، کنار نام شما نشان تولد{" "}
                      <BirthdayBadge className="mx-0.5 inline-flex h-4 w-4 align-middle" />{" "}
                      نمایش داده می‌شود.
                    </p>
                    {birthDate && (
                      <Button
                        type="button"
                        className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => setBirthDate(null)}
                      >
                        پاک کردن
                      </Button>
                    )}
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="gap-2 rounded-xl bg-primary hover:bg-primary/90"
                >
                  <Save size={17} />
                  {loading ? "در حال ذخیره..." : "ذخیره تغییرات"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="overflow-visible rounded-xl border-border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BriefcaseBusiness size={20} className="text-primary" />
                  اطلاعات سازمانی
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-6 pb-2">
                {organizationFields.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
                    <span className="min-w-0 flex-1 break-words px-1 text-left text-sm font-semibold text-foreground">
                      {value || "—"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-primary/20 bg-primary/10 shadow-sm">
              <CardContent className="flex items-center justify-between gap-4 p-6">
                <div>
                  <p className="font-bold text-foreground">امنیت حساب</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    رمز عبور خود را به‌صورت دوره‌ای تغییر دهید.
                  </p>
                </div>
                <Button asChild variant="outline" className="gap-2 rounded-xl bg-card">
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
