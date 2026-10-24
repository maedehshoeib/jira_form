import { Eye, EyeOff, Forward, Paperclip, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/portal";
import { formatPersianDateTime } from "@/lib/persianDate";

import type { SubmissionDetail } from "../types";
import { downloadWithAuth, uniqueNames } from "../utils";

type RequestInfoGridProps = {
  detail: SubmissionDetail;
  showSubmitter: boolean;
};

export function RequestInfoGrid({ detail, showSubmitter }: RequestInfoGridProps) {
  const initialNames = uniqueNames(
    (detail.initial_assignees ?? []).map((item) => item.display_name || item.username),
  );
  const referralNames = uniqueNames((detail.referrals ?? []).map((item) => item.to_user_name));
  const attachmentNames = detail.attachment_names?.length
    ? detail.attachment_names
    : detail.attachment_name
      ? [detail.attachment_name]
      : [];

  return (
  <div className="grid gap-3 rounded-2xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
    <div>
      <span className="text-muted-foreground">تاریخ ثبت:</span>{" "}
      <span className="font-semibold text-foreground">
        {formatPersianDateTime(detail.created_at)}
      </span>
    </div>
    <div>
      <span className="text-muted-foreground">نوع فرم:</span>{" "}
      <span className="font-semibold text-foreground">{detail.form_title}</span>
    </div>
    {showSubmitter && detail.submitted_by && (
      <div className="sm:col-span-2">
        <span className="text-muted-foreground">ثبت‌کننده:</span>{" "}
        <span className="font-semibold text-foreground">{detail.submitted_by}</span>
      </div>
    )}
    {(detail.jira_issue_key || detail.jira_status) && (
      <div className="rounded-2xl border border-border bg-card p-3 sm:col-span-2">
        <div className="mb-2 text-xs font-bold uppercase text-muted-foreground">Jira</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {detail.jira_issue_key && (
            <div>
              <span className="text-muted-foreground">Jira Issue:</span>{" "}
              <span className="font-semibold text-foreground">{detail.jira_issue_key}</span>
            </div>
          )}
          {detail.jira_status && (
            <div>
              <span className="text-muted-foreground">Jira Status:</span>{" "}
              <span className="whitespace-pre-wrap font-semibold text-foreground">
                {detail.jira_status}
              </span>
            </div>
          )}
        </div>
      </div>
    )}
    <div className="flex items-start gap-2 sm:col-span-2">
      <UserRound size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="shrink-0 text-muted-foreground">ارسال اولیه به:</span>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {initialNames.length > 0 ? (
          initialNames.map((name) => (
            <span
              key={name}
              className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground"
            >
              {name}
            </span>
          ))
        ) : (
          <span className="font-semibold text-muted-foreground">نامشخص</span>
        )}
      </div>
    </div>
    {referralNames.length > 0 && (
      <div className="flex items-start gap-2 sm:col-span-2">
        <Forward size={16} className="mt-0.5 shrink-0 text-violet-600" aria-hidden="true" />
        <span className="shrink-0 text-muted-foreground">ارجاع‌شده به:</span>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {referralNames.map((name) => (
            <span
              key={name}
              className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    )}
    <div className="flex items-center gap-2 sm:col-span-2">
      {detail.first_viewed_at ? (
        <Eye size={16} className="text-sky-600" aria-hidden="true" />
      ) : (
        <EyeOff size={16} className="text-amber-600" aria-hidden="true" />
      )}
      <span className="text-muted-foreground">اولین مشاهده توسط مسئول:</span>
      <span className="font-semibold text-foreground">
        {detail.first_viewed_at
          ? formatPersianDateTime(detail.first_viewed_at)
          : "هنوز مشاهده نشده"}
      </span>
    </div>
    {attachmentNames.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Paperclip size={16} className="text-red-500" />
        <span className="text-muted-foreground">پیوست:</span>
        {attachmentNames.map((name, index) => (
          <Button
            key={`${name}-${index}`}
            type="button"
            onClick={() =>
              void downloadWithAuth(
                `${API_BASE}/submissions/${detail.id}/attachment?index=${index}`,
                name,
              )
            }
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            {name}
          </Button>
        ))}
      </div>
    )}
  </div>
  );
}
