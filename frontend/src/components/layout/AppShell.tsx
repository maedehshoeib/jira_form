import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Home,
  ListTodo,
  LogOut,
  Menu,
  MessagesSquare,
  Volume2,
  VolumeX,
  BarChart3,
  BellRing,
  GitBranch,
  History,
  Megaphone,
  Users,
  X,
} from "lucide-react";
import UserAvatar from "../UserAvatar";
import UserDisplayName from "../UserDisplayName";

import logo from "../../assets/logo.png";
import { assetUrl } from "../../lib/assetUrl";
import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { formatUserDisplayName } from "../../lib/userDisplay";
import { cn } from "../../lib/utils";
import ThemeToggle from "../ThemeToggle";
import { Button } from "../ui/button";
import { chatService } from "@/features/chat";

type NavigationItem = {
  label: string;
  href: string;
  icon: typeof Home;
};

type TaskUnreadNotification = {
  count: number;
  ids: number[];
};

type CalendarNotification = {
  id: number;
  event_id: number;
  title: string;
  jalali_date: string;
  start_time: string;
  created_by_name: string;
};

type CalendarUnreadNotification = { count: number; items: CalendarNotification[] };

const navigationItems: NavigationItem[] = [
  { label: "خانه", href: "/", icon: Home },
  { label: "داشبورد من", href: "/dashboard", icon: BarChart3 },
  { label: "درخواست‌های من", href: "/my-requests", icon: ClipboardList },
  { label: "وظایف من", href: "/my-tasks", icon: ListTodo },
  { label: "تقویم من", href: "/my-calendar", icon: CalendarDays },
  { label: "گفتگو درون سازمانی", href: "/internal-chat", icon: MessagesSquare },
];

const adminNavigationItems: NavigationItem[] = [
  { label: "داشبورد", href: "/admin/dashboard", icon: BarChart3 },
  { label: "مدیریت بنر و اخبار", href: "/admin/banner", icon: Megaphone },
  { label: "مدیریت کاربران", href: "/admin/users", icon: Users },
  { label: "مسیریابی وظایف", href: "/admin/duties", icon: GitBranch },
  { label: "دستگاه‌ها و ورودها", href: "/admin/sessions", icon: History },
];

function playTone(muted: boolean) {
  if (muted) return;
  try {
    const AudioContextClass = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.23);
    oscillator.onended = () => void context.close();
  } catch {
    // Browsers may block audio until the user has interacted with the page.
  }
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [taskUnreadCount, setTaskUnreadCount] = useState(0);
  const [calendarUnreadCount, setCalendarUnreadCount] = useState(0);
  const [calendarToast, setCalendarToast] = useState<CalendarNotification | null>(null);
  const [chatSoundMuted, setChatSoundMuted] = useState(
    () => localStorage.getItem("chat_notification_sound_muted") === "true",
  );
  const [taskSoundMuted, setTaskSoundMuted] = useState(
    () => localStorage.getItem("tasks_notification_sound_muted") === "true",
  );
  const knownUnreadRef = useRef<Map<number, number> | null>(null);
  const knownUnreadTaskIdsRef = useRef<Set<number> | null>(null);
  const knownCalendarNotificationIdsRef = useRef<Set<number> | null>(null);

  const playChatNotificationSound = useCallback(() => {
    playTone(chatSoundMuted);
  }, [chatSoundMuted]);

  const playTaskNotificationSound = useCallback(() => {
    playTone(taskSoundMuted);
  }, [taskSoundMuted]);

  const refreshChatNotifications = useCallback(async () => {
    try {
      const conversations = await chatService.conversations(false);
      const nextUnread = new Map(
        conversations.map((conversation) => [conversation.id, conversation.unread_count]),
      );
      const previous = knownUnreadRef.current;
      const hasNewMessage = previous !== null && conversations.some(
        (conversation) =>
          !conversation.is_muted &&
          conversation.unread_count > (previous.get(conversation.id) || 0),
      );
      knownUnreadRef.current = nextUnread;
      setChatUnreadCount(
        conversations.reduce((total, conversation) => total + conversation.unread_count, 0),
      );
      if (hasNewMessage) playChatNotificationSound();
    } catch {
      // Keep navigation usable if chat notifications are temporarily unavailable.
    }
  }, [playChatNotificationSound]);

  const refreshTaskNotifications = useCallback(async () => {
    try {
      const { data } = await client.get<TaskUnreadNotification>(endpoints.taskUnseenCount);
      const nextIds = new Set(data.ids);
      const previous = knownUnreadTaskIdsRef.current;
      const hasNewTask =
        previous !== null && data.ids.some((id) => !previous.has(id));
      knownUnreadTaskIdsRef.current = nextIds;
      setTaskUnreadCount(data.count);
      if (hasNewTask) playTaskNotificationSound();
    } catch {
      // Keep navigation usable if task notifications are temporarily unavailable.
    }
  }, [playTaskNotificationSound]);

  const refreshCalendarNotifications = useCallback(async () => {
    try {
      const { data } = await client.get<CalendarUnreadNotification>(endpoints.calendarNotifications);
      const nextIds = new Set(data.items.map((item) => item.id));
      const previous = knownCalendarNotificationIdsRef.current;
      const newest = data.items.find((item) => previous === null || !previous.has(item.id));
      knownCalendarNotificationIdsRef.current = nextIds;
      setCalendarUnreadCount(data.count);
      if (newest) {
        setCalendarToast(newest);
        if (previous !== null) playTone(false);
      }
      if (data.count === 0) setCalendarToast(null);
    } catch {
      // Keep navigation usable if calendar notifications are unavailable.
    }
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    void refreshChatNotifications();
    const timer = window.setInterval(() => void refreshChatNotifications(), 8000);
    window.addEventListener("chat:refresh-notifications", refreshChatNotifications);
    window.addEventListener("chat:new-message", playChatNotificationSound);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("chat:refresh-notifications", refreshChatNotifications);
      window.removeEventListener("chat:new-message", playChatNotificationSound);
    };
  }, [playChatNotificationSound, refreshChatNotifications]);

  useEffect(() => {
    void refreshTaskNotifications();
    const timer = window.setInterval(() => void refreshTaskNotifications(), 8000);
    window.addEventListener("tasks:refresh-notifications", refreshTaskNotifications);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("tasks:refresh-notifications", refreshTaskNotifications);
    };
  }, [refreshTaskNotifications]);

  useEffect(() => {
    void refreshCalendarNotifications();
    const timer = window.setInterval(() => void refreshCalendarNotifications(), 8000);
    window.addEventListener("calendar:refresh-notifications", refreshCalendarNotifications);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("calendar:refresh-notifications", refreshCalendarNotifications);
    };
  }, [refreshCalendarNotifications]);

  const toggleChatSound = () => {
    const next = !chatSoundMuted;
    setChatSoundMuted(next);
    localStorage.setItem("chat_notification_sound_muted", String(next));
  };

  const toggleTaskSound = () => {
    const next = !taskSoundMuted;
    setTaskSoundMuted(next);
    localStorage.setItem("tasks_notification_sound_muted", String(next));
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isWideLayout =
    pathname === "/" || pathname === "/my-calendar" || pathname.startsWith("/departments/");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const renderCountBadge = (count: number, active: boolean) => (
    <span className={cn(
      "min-w-6 rounded-full border px-1.5 py-0.5 text-center text-xs font-bold",
      active
        ? "border-sidebar-primary-foreground/20 bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground"
        : "border-sidebar-border bg-sidebar-accent text-sidebar-foreground",
    )}>
      {count > 99 ? "+۹۹" : count.toLocaleString("fa-IR")}
    </span>
  );

  const renderSoundToggle = (
    muted: boolean,
    active: boolean,
    onToggle: () => void,
    enableLabel: string,
    disableLabel: string,
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={muted ? enableLabel : disableLabel}
      aria-label={muted ? enableLabel : disableLabel}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={cn("rounded-md text-inherit hover:bg-sidebar-accent", active && "hover:bg-sidebar-primary-foreground/15")}
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </Button>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-5 py-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sidebar-border bg-background p-2 shadow-sm">
            <img src={assetUrl(logo)} alt="وثوق گستر" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-7 text-sidebar-foreground">سامانه جامع خدمات</h1>
            <p className="mt-0.5 text-xs text-sidebar-foreground/70">ثبت و پیگیری درخواست‌ها</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6" aria-label="منوی اصلی">
        <p className="mb-3 px-3 text-xs font-medium text-sidebar-foreground/65">دسترسی سریع</p>
        {navigationItems
          .filter((item) => !user?.is_admin || item.href !== "/dashboard")
          .map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const label =
            user?.is_admin && item.href === "/my-requests"
              ? "همه درخواست‌ها"
              : item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  active ? "bg-sidebar-primary-foreground/15" : "bg-sidebar-primary-foreground/10 text-sidebar-foreground"
                )}
              >
                <Icon size={19} />
              </span>
              <span className="flex-1">{label}</span>
              {item.href === "/my-tasks" && taskUnreadCount > 0 &&
                renderCountBadge(taskUnreadCount, active)}
              {item.href === "/my-calendar" && calendarUnreadCount > 0 &&
                renderCountBadge(calendarUnreadCount, active)}
              {item.href === "/my-tasks" &&
                renderSoundToggle(
                  taskSoundMuted,
                  active,
                  toggleTaskSound,
                  "فعال کردن صدای اعلان وظایف",
                  "بی‌صدا کردن اعلان وظایف",
                )}
              {item.href === "/internal-chat" && chatUnreadCount > 0 &&
                renderCountBadge(chatUnreadCount, active)}
              {item.href === "/internal-chat" &&
                renderSoundToggle(
                  chatSoundMuted,
                  active,
                  toggleChatSound,
                  "فعال کردن صدای اعلان گفتگو",
                  "بی‌صدا کردن اعلان گفتگو",
                )}
              <ChevronLeft
                size={16}
                className={cn(
                  "transition-transform group-hover:-translate-x-1",
                  active ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/55"
                )}
              />
            </Link>
          );
          })}
        {user?.is_admin && (
          <>
            <div className="mx-3 my-5 border-t border-sidebar-border" />
            <p className="mb-3 px-3 text-xs font-medium text-sidebar-foreground/65">مدیریت سامانه</p>
            {adminNavigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", active ? "bg-sidebar-primary-foreground/15" : "bg-sidebar-primary-foreground/10 text-sidebar-foreground")}>
                    <Icon size={19} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <ChevronLeft size={16} className={active ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/55"} />
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        {user && (
          <Link
            href="/profile"
            className="mb-3 block rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3 transition-colors hover:bg-sidebar-accent"
          >
            <div className="flex items-center gap-3">
              <UserAvatar
                name={formatUserDisplayName(user)}
                avatarUrl={user.avatar_url}
                className="h-11 w-11 rounded-xl shadow-sm"
                fallbackClassName="bg-sidebar-primary text-sidebar-primary-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  <UserDisplayName
                    user={user}
                    className="max-w-full"
                    badgeClassName="h-4 w-4 bg-amber-300/25 text-amber-200 ring-amber-200/40"
                  />
                </p>
                <p className="mt-0.5 truncate text-xs text-sidebar-foreground/70">{user.username}</p>
              </div>
            </div>

            {(user.department || user.email) && (
              <div className="mt-3 space-y-1.5 border-t border-sidebar-border pt-3 text-xs text-sidebar-foreground/70">
                {user.department && (
                  <p className="flex items-center gap-2 truncate">
                    <Building2 size={13} className="shrink-0" />
                    <span className="truncate">{user.department}</span>
                  </p>
                )}
                {user.email && <p className="truncate" dir="ltr">{user.email}</p>}
              </div>
            )}
          </Link>
        )}

        <ThemeToggle variant="sidebar" className="mb-2" />
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="h-10 w-full justify-start gap-3 rounded-lg px-3 text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut size={18} />
          خروج از حساب کاربری
        </Button>
      </div>
    </div>
  );

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-background font-sans text-foreground"
    >
      <aside className="no-print fixed inset-y-0 right-0 z-50 hidden w-72 overflow-hidden border-l border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="no-print fixed inset-0 z-[90] lg:hidden">
          <Button
            type="button"
            aria-label="بستن منو"
            variant="ghost"
            className="absolute inset-0 h-auto w-auto rounded-none bg-foreground/20 backdrop-blur-sm hover:bg-foreground/25"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 w-[min(19rem,88vw)] overflow-hidden border-l border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="بستن منو"
              onClick={() => setSidebarOpen(false)}
              className="absolute left-3 top-3 z-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <X size={20} />
            </Button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:mr-72">
        <div className="no-print sticky top-0 z-40 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur-lg lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <img src={assetUrl(logo)} alt="وثوق گستر" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-sm font-bold text-foreground">سامانه جامع خدمات</p>
              <p className="text-[11px] text-muted-foreground">ثبت و پیگیری درخواست‌ها</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle className="border-primary/20 text-primary dark:border-slate-600 dark:text-red-300" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="باز کردن منو"
              onClick={() => setSidebarOpen(true)}
              className="h-10 w-10 rounded-xl border-primary/20 text-primary dark:border-slate-600 dark:text-red-300"
            >
              <Menu size={21} />
            </Button>
          </div>
        </div>

        <main
          className={cn(
            "theme-surfaces w-full p-4 sm:p-6",
            isWideLayout ? "max-w-none lg:p-6 xl:px-7" : "mx-auto max-w-7xl lg:p-8",
          )}
        >
          {children}
        </main>
      </div>
      {calendarToast && pathname !== "/my-calendar" && (
        <Link href="/my-calendar" className="no-print fixed bottom-5 left-5 z-[100] w-[min(24rem,calc(100vw-2.5rem))] rounded-2xl border border-blue-200 bg-card p-4 shadow-2xl dark:border-blue-800 dark:bg-slate-900">
          <Button type="button" onClick={(event) => { event.preventDefault(); setCalendarToast(null); }} className="absolute left-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted" aria-label="بستن اعلان"><X size={16} /></Button>
          <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700"><BellRing size={20} /></span><div className="min-w-0"><p className="text-xs font-bold text-blue-700">زمان جدید در تقویم شما</p><p className="mt-1 truncate font-bold">{calendarToast.title}</p><p className="mt-1 text-xs text-muted-foreground">{calendarToast.jalali_date}، ساعت {calendarToast.start_time} · ثبت توسط {calendarToast.created_by_name}</p></div></div>
        </Link>
      )}
    </div>
  );
}
