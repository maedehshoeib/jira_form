import axios from "axios";
import { KeyRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import logo from "@/assets/logo.png";
import { assetUrl } from "@/lib/assetUrl";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

export default function ChangePasswordPage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("تکرار رمز عبور با رمز عبور جدید یکسان نیست.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await client.post(endpoints.changePassword, {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      updateUser(data);
      router.replace(user?.must_change_password ? "/profile" : "/");
    } catch (requestError) {
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.detail
        : null;
      setError(
        typeof message === "string"
          ? message
          : "تغییر رمز عبور انجام نشد. اطلاعات واردشده را بررسی کنید."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-slate-50 to-red-50 px-4 font-sans dark:from-slate-950 dark:via-slate-900 dark:to-red-950/40"
    >
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <ThemeToggle className="border-primary/20 text-primary dark:border-slate-600 dark:bg-slate-800/80 dark:text-red-300" />
      </div>

      <div className="w-full max-w-md rounded-3xl border border-transparent bg-card p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:p-10">
        <div className="mb-7 flex flex-col items-center text-center">
          <img src={assetUrl(logo)} alt="وثوق گستر" className="mb-4 h-16 object-contain" />
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-red-950/60 dark:text-red-300">
            <KeyRound size={24} />
          </div>
          <h1 className="text-2xl font-bold text-foreground dark:text-slate-100">تغییر رمز عبور</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-muted-foreground">
            {user?.must_change_password
              ? "برای ادامه، رمز عبور پیش‌فرض خود را تغییر دهید."
              : "برای امنیت حساب، ابتدا رمز عبور فعلی را وارد کنید."}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <Input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="رمز عبور فعلی"
            required
            className="h-12 rounded-xl"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
            minLength={8}
            required
            className="h-12 rounded-xl"
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="تکرار رمز عبور جدید"
            minLength={8}
            required
            className="h-12 rounded-xl"
          />
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-primary hover:bg-primary/90"
          >
            {loading ? "در حال ذخیره..." : "ذخیره رمز عبور جدید"}
          </Button>
        </form>
      </div>
    </div>
  );
}
