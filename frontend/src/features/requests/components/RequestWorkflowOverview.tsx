import {
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Forward,
  XCircle,
} from "lucide-react";

import type { WorkflowStatus } from "../types";
import { workflowStatusMeta, workflowStepIndex } from "../utils";

export function WorkflowStatusIcon({
  status,
  size = 15,
}: {
  status: WorkflowStatus;
  size?: number;
}) {
  if (status === "unseen") return <EyeOff size={size} aria-hidden="true" />;
  if (status === "seen") return <Eye size={size} aria-hidden="true" />;
  if (status === "referred") return <Forward size={size} aria-hidden="true" />;
  if (status === "in_progress") return <Clock3 size={size} aria-hidden="true" />;
  if (status === "completed") return <CheckCircle2 size={size} aria-hidden="true" />;
  return <XCircle size={size} aria-hidden="true" />;
}

export function WorkflowOverview({ status }: { status: WorkflowStatus }) {
  const currentStep = workflowStepIndex(status);
  const statusMeta = workflowStatusMeta(status);
  const steps = [
    "ثبت درخواست",
    "مشاهده توسط مسئول",
    status === "referred"
      ? "ارجاع به مسئول"
      : status === "in_progress"
        ? "در حال رسیدگی"
        : "رسیدگی درخواست",
    status === "completed"
      ? "انجام‌شده"
      : status === "rejected"
        ? "رد‌شده"
        : "نتیجه نهایی",
  ];

  return (
    <section
      aria-label="جایگاه فعلی درخواست در فرایند رسیدگی"
      className="rounded-3xl border border-border bg-muted/40 p-4 sm:p-5"
    >
      <div className="mb-5 flex items-start gap-3">
        <div
          className={
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border " +
            statusMeta.badgeClass
          }
        >
          <WorkflowStatusIcon status={status} size={19} />
        </div>
        <div>
          <h4 className="font-bold text-foreground">
            جایگاه فعلی: {statusMeta.label}
          </h4>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {statusMeta.description}
          </p>
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((label, index) => {
          const passed = index < currentStep;
          const current = index === currentStep;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={[
                "flex min-h-20 items-center gap-2 rounded-2xl border px-3 py-3 text-xs font-semibold transition",
                passed
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                  : current
                    ? statusMeta.badgeClass
                    : "border-border bg-card text-muted-foreground",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                  passed
                    ? "bg-emerald-600 text-white"
                    : current
                      ? "bg-card/80"
                      : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {passed ? (
                  <CheckCircle2 size={15} aria-hidden="true" />
                ) : current ? (
                  <WorkflowStatusIcon status={status} size={14} />
                ) : (
                  (index + 1).toLocaleString("fa-IR")
                )}
              </span>
              <span className="leading-5">{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
