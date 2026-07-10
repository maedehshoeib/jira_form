import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";
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
      await login(username, password);
      navigate(from, { replace: true });
    } catch {
      setError("نام کاربری یا رمز عبور اشتباه است");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-slate-50 to-red-50 px-4 font-sans"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="وثوق گستر" className="mb-4 h-20 object-contain" />
          <h1 className="text-2xl font-bold text-red-600">سامانه جامع خدمات</h1>
          <p className="mt-2 text-sm text-slate-500">
            با نام کاربری و رمز عبور سیستم سازمانی وارد شوید
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              نام کاربری
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="نام کاربری سیستم"
              required
              className="h-12 rounded-xl"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              رمز عبور
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="رمز عبور سیستم"
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

        <p className="mt-6 text-center text-xs text-slate-400">
          کاربران جدید با اولین ورود به صورت خودکار ثبت می‌شوند
        </p>
      </div>
    </div>
  );
}
