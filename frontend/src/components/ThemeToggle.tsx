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
      <Button
        type="button"
        variant="ghost"
        onClick={toggleTheme}
        title={label}
        aria-label={label}
        className={cn(
          "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          className,
        )}
      >
        <Icon size={18} />
        <span className="flex-1 text-right">{label}</span>
      </Button>
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
