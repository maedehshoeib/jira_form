import Image from "next/image";

import welcomeBot from "@/assets/home-icons/welcome-bot.jpg";
import { useAuth } from "@/context/AuthContext";
import {
  formatUserDisplayName,
  hasUserBirthday,
} from "@/lib/userDisplay";
import { cn } from "@/lib/utils";

function buildWelcomeMessage(name: string, isBirthday: boolean): string {
  if (isBirthday) {
    return `تولدت مبارک ${name}! امیدوارم روز فوق‌العاده‌ای داشته باشی.`;
  }
  return `سلام ${name}! خوش اومدی. روز خوبی داشته باشی.`;
}

export default function WelcomeBot() {
  const { user } = useAuth();
  const name = formatUserDisplayName(user, "همکار");
  const isBirthday = hasUserBirthday(user);
  const message = buildWelcomeMessage(name, isBirthday);

  return (
    <aside
      dir="rtl"
      aria-label="پیام خوش‌آمدگویی"
      className={cn(
        "fixed bottom-4 left-4 z-40 flex max-w-[min(22rem,calc(100vw-2rem))] items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-lg backdrop-blur-sm",
        isBirthday
          ? "border-rose-200/90 bg-gradient-to-l from-rose-50/95 via-amber-50/95 to-card/95 dark:border-rose-400/30 dark:from-rose-950/80 dark:via-amber-950/70 dark:to-slate-900/90"
          : "border-border/90 bg-card/95 dark:border-slate-600 dark:bg-slate-900/90",
      )}
    >
      <div
        className={cn(
          "relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2",
          isBirthday
            ? "ring-rose-300/80 dark:ring-rose-400/50"
            : "ring-border dark:ring-white/20",
        )}
      >
        <Image
          src={welcomeBot}
          alt="ربات خوش‌آمدگو"
          fill
          sizes="56px"
          className="object-cover object-top"
          priority
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-muted-foreground dark:text-white/45">
          {isBirthday ? "پیام تولد" : "ربات خوش‌آمدگو"}
        </p>
        <p className="mt-0.5 text-sm font-semibold leading-6 text-foreground dark:text-white">
          {message}
        </p>
      </div>
    </aside>
  );
}
