import type { AssigneeProgress } from "../types";
import { normalizedProgress } from "../utils";

type AssigneeProgressListProps = {
  items: AssigneeProgress[];
  compact?: boolean;
  /** When set, only this many rows render; remaining count is summarized. */
  maxVisible?: number;
};

export function AssigneeProgressList({
  items,
  compact = false,
  maxVisible,
}: AssigneeProgressListProps) {
  const limit = maxVisible ?? (compact ? 3 : undefined);
  const visible = limit != null ? items.slice(0, limit) : items;
  const hiddenCount = items.length - visible.length;

  return (
    <div className={compact ? "max-h-36 space-y-2 overflow-hidden" : "grid gap-3 sm:grid-cols-2"}>
      {visible.map((item) => {
        const progress = normalizedProgress(item.progress_percent);
        const name = item.display_name || item.username || "نامشخص";
        return (
          <div key={item.user_id} className="rounded-xl border border-border/70 bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate font-semibold text-foreground" title={name}>
                {name}
              </span>
              <span className="shrink-0 font-extrabold tabular-nums text-foreground">
                {progress.toLocaleString("fa-IR")}٪
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`درصد پیشرفت ${name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-2 overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <p className="px-1 text-[11px] font-semibold text-muted-foreground">
          و {hiddenCount.toLocaleString("fa-IR")} نفر دیگر
        </p>
      )}
    </div>
  );
}
