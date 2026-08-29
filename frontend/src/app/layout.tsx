import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "سامانه جامع خدمات",
  description: "پرتال ثبت درخواست و گزارش‌گیری سازمانی",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
