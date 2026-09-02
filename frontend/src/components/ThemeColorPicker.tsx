import { Check, Palette } from "lucide-react";

import { useTheme, type ThemeColor } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";

const COLOR_OPTIONS: Array<{
  value: ThemeColor;
  label: string;
  swatches: [string, string, string];
}> = [
  { value: "red", label: "قرمز", swatches: ["#fca5a5", "#ef4444", "#991b1b"] },
  { value: "blue", label: "آبی", swatches: ["#93c5fd", "#3b82f6", "#1e40af"] },
  { value: "green", label: "سبز", swatches: ["#86efac", "#22c55e", "#166534"] },
  { value: "violet", label: "بنفش", swatches: ["#c4b5fd", "#8b5cf6", "#5b21b6"] },
  { value: "orange", label: "نارنجی", swatches: ["#fdba74", "#f97316", "#9a3412"] },
];

export default function ThemeColorPicker() {
  const { themeColor, setThemeColor } = useTheme();

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Palette size={20} />
        </span>
        <div>
          <p className="font-bold text-foreground">رنگ پوسته</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            رنگ اصلی دکمه‌ها، لینک‌ها و تأکیدهای سامانه را انتخاب کنید.
          </p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="انتخاب رنگ پوسته"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {COLOR_OPTIONS.map((option) => {
          const active = themeColor === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`پوسته ${option.label}`}
              variant="outline"
              onClick={() => setThemeColor(option.value)}
              className={cn(
                "relative h-auto min-h-20 flex-col gap-2 rounded-2xl bg-card px-3 py-3 hover:bg-muted/60",
                active && "border-primary bg-primary/5 ring-2 ring-primary/20",
              )}
            >
              <span className="flex items-center gap-1" aria-hidden="true">
                {option.swatches.map((swatch) => (
                  <span
                    key={swatch}
                    className="h-4 w-4 rounded-full border border-black/5 shadow-sm"
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </span>
              <span className="text-xs font-semibold text-foreground">{option.label}</span>
              {active && (
                <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
