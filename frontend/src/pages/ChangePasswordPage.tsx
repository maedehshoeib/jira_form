import axios from "axios";
import { KeyRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import client from "../api/client";
import { endpoints } from "../api/endpoints";
import logo from "../assets/logo.png";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";

export default function ChangePasswordPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
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
      navigate(user?.must_change_password ? "/profile" : "/", { replace: true });
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
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-slate-50 to-red-50 px-4 font-sans"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl sm:p-10">
        <div className="mb-7 flex flex-col items-center text-center">
          <img src={logo} alt="وثوق گستر" className="mb-4 h-16 object-contain" />
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <KeyRound size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">تغییر رمز عبور</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {user?.must_change_password
              ? "برای ادامه، رمز عبور پیش‌فرض خود را تغییر دهید."
              : "برای امنیت حساب، ابتدا رمز عبور فعلی را وارد کنید."}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
            className="h-12 w-full rounded-xl bg-red-600 hover:bg-red-700"
          >
            {loading ? "در حال ذخیره..." : "ذخیره رمز عبور جدید"}
          </Button>
        </form>
      </div>
    </div>
  );
}
