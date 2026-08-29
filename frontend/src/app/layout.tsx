import type { Metadata } from "next";

import { AppProviders } from "@/app/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "سامانه جامع خدمات",
  description: "پرتال ثبت درخواست و گزارش‌گیری سازمانی",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
