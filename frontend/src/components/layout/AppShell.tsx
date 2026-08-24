import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
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
import { Link, useLocation, useNavigate } from "react-router-dom";

import logo from "../../assets/logo.png";
import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { formatUserDisplayName } from "../../lib/userDisplay";
import { cn } from "../../lib/utils";
import ThemeToggle from "../ThemeToggle";
import { Button } from "../ui/button";
import { chatService } from "../../services/chat.service";

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
  const navigate = useNavigate();
  const location = useLocation();
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
  }, [location.pathname]);

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
    navigate("/login");
  };

  const isWideLayout =
    location.pathname === "/" || location.pathname === "/my-calendar" || location.pathname.startsWith("/departments/");

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  const renderCountBadge = (count: number, active: boolean) => (
    <span className={cn(
      "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-extrabold",
      active ? "bg-red-600 text-white" : "bg-white text-red-700",
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
    <button
      type="button"
      title={muted ? enableLabel : disableLabel}
      aria-label={muted ? enableLabel : disableLabel}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "rounded-lg p-1 transition-colors",
        active ? "hover:bg-red-100" : "hover:bg-white/15",
      )}
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-5 py-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-lg shadow-red-950/20">
            <img src={logo} alt="وثوق گستر" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold leading-7 text-white">سامانه جامع خدمات</h1>
            <p className="mt-0.5 text-xs text-red-100/75">ثبت و پیگیری درخواست‌ها</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6" aria-label="منوی اصلی">
        <p className="mb-3 px-3 text-xs font-semibold text-red-100/55">دسترسی سریع</p>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const label =
            user?.is_admin && item.href === "/my-requests"
              ? "همه درخواست‌ها"
              : item.label;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all",
                active
                  ? "bg-white text-red-700 shadow-lg shadow-red-950/15"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                  active ? "bg-red-50 text-red-600" : "bg-white/10 text-white"
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
                  active ? "text-red-400" : "text-white/35"
                )}
              />
            </Link>
          );
        })}
        {user?.is_admin && (
          <>
            <div className="mx-3 my-5 border-t border-white/10" />
            <p className="mb-3 px-3 text-xs font-semibold text-red-100/55">مدیریت سامانه</p>
            {adminNavigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all",
                    active
                      ? "bg-white text-red-700 shadow-lg shadow-red-950/15"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-red-50 text-red-600" : "bg-white/10 text-white")}>
                    <Icon size={19} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <ChevronLeft size={16} className={active ? "text-red-400" : "text-white/35"} />
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-4">
        {user && (
          <Link
            to="/profile"
            className="mb-3 block rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/10 transition-colors hover:bg-white/15"
          >
            <div className="flex items-center gap-3">
              <UserAvatar
                name={formatUserDisplayName(user)}
                avatarUrl={user.avatar_url}
                className="h-11 w-11 rounded-xl shadow-sm"
                fallbackClassName="bg-white text-red-600"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">
                  <UserDisplayName
                    user={user}
                    className="max-w-full"
                    badgeClassName="h-4 w-4 bg-amber-300/25 text-amber-200 ring-amber-200/40"
                  />
                </p>
                <p className="mt-0.5 truncate text-xs text-red-100/70">{user.username}</p>
              </div>
            </div>

            {(user.department || user.email) && (
              <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs text-red-50/70">
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
          className="h-11 w-full justify-start gap-3 rounded-xl px-4 text-red-50 hover:bg-white/10 hover:text-white"
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
      className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-red-50 font-sans text-slate-900 transition-colors duration-500 dark:from-slate-950 dark:via-slate-900 dark:to-red-950/40 dark:text-slate-100"
    >
      <aside className="no-print fixed inset-y-0 right-0 z-50 hidden w-72 overflow-hidden bg-gradient-to-b from-red-700 via-red-700 to-red-900 shadow-2xl lg:block">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="no-print fixed inset-0 z-[90] lg:hidden">
          <button
            type="button"
            aria-label="بستن منو"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 w-[min(19rem,88vw)] overflow-hidden bg-gradient-to-b from-red-700 via-red-700 to-red-900 shadow-2xl">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="بستن منو"
              onClick={() => setSidebarOpen(false)}
              className="absolute left-3 top-3 z-10 text-white hover:bg-white/10 hover:text-white"
            >
              <X size={20} />
            </Button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:mr-72">
        <div className="no-print sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-lg dark:border-slate-700 dark:bg-slate-900/90 lg:hidden">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="وثوق گستر" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">سامانه جامع خدمات</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">ثبت و پیگیری درخواست‌ها</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle className="border-red-100 text-red-600 dark:border-slate-600 dark:text-red-300" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="باز کردن منو"
              onClick={() => setSidebarOpen(true)}
              className="h-10 w-10 rounded-xl border-red-100 text-red-600 dark:border-slate-600 dark:text-red-300"
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
      {calendarToast && location.pathname !== "/my-calendar" && (
        <Link to="/my-calendar" className="no-print fixed bottom-5 left-5 z-[100] w-[min(24rem,calc(100vw-2.5rem))] rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl dark:border-blue-800 dark:bg-slate-900">
          <button type="button" onClick={(event) => { event.preventDefault(); setCalendarToast(null); }} className="absolute left-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="بستن اعلان"><X size={16} /></button>
          <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700"><BellRing size={20} /></span><div className="min-w-0"><p className="text-xs font-bold text-blue-700">زمان جدید در تقویم شما</p><p className="mt-1 truncate font-bold">{calendarToast.title}</p><p className="mt-1 text-xs text-slate-500">{calendarToast.jalali_date}، ساعت {calendarToast.start_time} · ثبت توسط {calendarToast.created_by_name}</p></div></div>
        </Link>
      )}
    </div>
  );
}
