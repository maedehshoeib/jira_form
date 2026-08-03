import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";
import ThemeToggle from "../components/ThemeToggle";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loggedInUser = await login(username, password);
      navigate(
        loggedInUser.must_change_password
          ? "/change-password"
          : loggedInUser.is_admin && from === "/"
            ? "/admin/dashboard"
            : from,
        { replace: true }
      );
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.detail ||
          "نام کاربری یا رمز عبور اشتباه است"
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
        <ThemeToggle className="border-red-100 text-red-600 dark:border-slate-600 dark:bg-slate-800/80 dark:text-red-300" />
      </div>

      <div className="w-full max-w-md rounded-3xl border border-transparent bg-white p-10 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="وثوق گستر" className="mb-4 h-20 object-contain" />
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">سامانه جامع خدمات</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            با نام کاربری و رمز عبور سیستم سازمانی وارد شوید
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              نام کاربری
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: f.amiri"
              required
              className="h-12 rounded-xl"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              رمز عبور
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="رمز عبور"
              required
              className="h-12 rounded-xl"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-base hover:bg-red-700"
          >
            <LogIn size={18} />
            {loading ? "در حال ورود..." : "ورود به سامانه"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          در اولین ورود، تغییر رمز عبور پیش‌فرض الزامی است.
        </p>
      </div>
    </div>
  );
}
