import { normalizedProgress, progressBarClass } from "../utils";

export function TaskProgress({
  progress,
  status,
  compact = false,
}: {
  progress: number;
  status: string;
  compact?: boolean;
}) {
  const value = normalizedProgress(progress, status);
  return (
    <div className={compact ? "mt-4" : "rounded-2xl border border-border bg-muted/40 p-4"}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-muted-foreground">{"\u067e\u06cc\u0634\u0631\u0641\u062a \u0627\u0646\u062c\u0627\u0645 \u062f\u0631\u062e\u0648\u0627\u0633\u062a"}</span>
        <span dir="ltr" className="font-extrabold tabular-nums text-foreground">
          {value}%
        </span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="\u067e\u06cc\u0634\u0631\u0641\u062a \u0627\u0646\u062c\u0627\u0645 \u062f\u0631\u062e\u0648\u0627\u0633\u062a"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          className={`h-full rounded-full transition-all ${progressBarClass(status)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
