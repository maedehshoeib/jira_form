"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
      <h1 className="text-xl font-semibold">بارگذاری صفحه با خطا روبه‌رو شد</h1>
      <Button onClick={reset}>تلاش دوباره</Button>
    </main>
  );
}
