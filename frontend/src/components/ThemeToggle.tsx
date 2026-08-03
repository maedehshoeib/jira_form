import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme, type ThemePreference } from "../context/ThemeContext";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

const LABELS: Record<ThemePreference, string> = {
  light: "حالت روشن",
  dark: "حالت تاریک",
  system: "هماهنگ با سیستم",
};

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

type ThemeToggleProps = {
  className?: string;
  variant?: "sidebar" | "default" | "ghost";
};

export default function ThemeToggle({
  className,
  variant = "default",
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const Icon = ICONS[theme];
  const label = LABELS[theme];

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={label}
        aria-label={label}
        className={cn(
          "flex h-11 w-full items-center gap-3 rounded-xl px-4 text-sm font-semibold text-red-50 transition-colors hover:bg-white/10 hover:text-white",
          className,
        )}
      >
        <Icon size={18} />
        <span className="flex-1 text-right">{label}</span>
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant === "ghost" ? "ghost" : "outline"}
      size="icon"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className={cn("h-10 w-10 rounded-xl", className)}
    >
      <Icon size={18} />
    </Button>
  );
}
