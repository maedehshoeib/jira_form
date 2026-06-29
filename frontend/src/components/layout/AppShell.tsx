import { ReactNode } from "react";
import logo from "../../assets/logo.png";

export default function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      dir="rtl"
      className="
      min-h-screen
      bg-gradient-to-br
      from-white
      via-slate-50
      to-red-50
      "
    >
      <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">

          {/* Logo */}

          <div className="flex items-center gap-5">

            <img
              src={logo}
              alt="وثوق گستر"
              className="h-16 object-contain"
            />

            <div>
              <h1 className="text-3xl font-extrabold text-red-600">
                سامانه جامع خدمات
              </h1>

              <p className="text-sm text-slate-500">
                سیستم ثبت و پیگیری درخواست‌های سازمانی
              </p>
            </div>

          </div>

          {/* Right Side */}

          <div className="text-left">

            <div className="text-sm text-slate-500">
              نسخه ۱.۰
            </div>

          </div>

        </div>
      </header>

      <main className="mx-auto max-w-7xl p-8">
        {children}
      </main>

    </div>
  );
}