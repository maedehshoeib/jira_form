import { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import logo from "../../assets/logo.png";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/button";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-red-50 font-sans"
    >
      <header className="no-print sticky top-0 z-50 border-b bg-white/90 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-5">
            <img src={logo} alt="وثوق گستر" className="h-16 object-contain" />

            <div>
              <h1 className="text-3xl font-extrabold text-red-600">
                سامانه جامع خدمات
              </h1>
              <p className="text-sm text-slate-500">
                سیستم ثبت و پیگیری درخواست‌های سازمانی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-left">
            {user && (
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">
                  {user.display_name}
                </p>
                <p className="text-xs text-slate-500">{user.username}</p>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2 rounded-xl"
            >
              <LogOut size={16} />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-8">{children}</main>
    </div>
  );
}
