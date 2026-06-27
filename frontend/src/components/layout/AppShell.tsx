import { ReactNode } from 'react';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      <div
        className="
          sticky
          top-0
          z-50
          border-b
          bg-white/90
          backdrop-blur-md
          shadow-sm
        "
      >
        <div className="mx-auto max-w-7xl px-6 py-5">
          <h1 className="text-3xl font-bold text-red-600">
            سامانه جامع خدمات
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            سیستم ثبت و پیگیری درخواست‌های سازمانی
          </p>
        </div>
      </div>

      <div
        className="
          min-h-[calc(100vh-90px)]
          bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.08),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(239,68,68,0.05),transparent_40%)]
        "
      >
        <div className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}