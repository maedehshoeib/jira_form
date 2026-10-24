import { Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/portal";
import { formatPersianDateTime } from "@/lib/persianDate";

import type { TimelineItem } from "../types";
import {
  downloadWithAuth,
  normalizedProgress,
  parseTimelineEntityId,
  timelineEventDotClass,
  timelineEventLabel,
} from "../utils";

function attachmentNames(item: TimelineItem) {
  if (item.attachment_names?.length) return item.attachment_names;
  return item.attachment_name ? [item.attachment_name] : [];
}

export function RequestTimeline({
  submissionId,
  timeline,
}: {
  submissionId: number;
  timeline: TimelineItem[];
}) {
  const base = `${API_BASE}/submissions/${submissionId}`;

  const downloadAttachment = async (
    item: TimelineItem,
    index: number,
    fileName: string,
  ) => {
    if (item.event_type === "referred") {
      const referralId = parseTimelineEntityId(item.id, "referral");
      if (!referralId) return;
      await downloadWithAuth(
        `${base}/referrals/${referralId}/attachment?index=${index}`,
        fileName,
      );
      return;
    }
    if (item.event_type === "status_changed") {
      const historyId = parseTimelineEntityId(item.id, "status");
      if (!historyId) return;
      await downloadWithAuth(`${base}/status-history/${historyId}/attachment`, fileName);
    }
  };

  return (
    <section aria-labelledby="request-timeline-title" className="space-y-4">
      <div>
        <h4 id="request-timeline-title" className="text-lg font-extrabold text-foreground">
          مسیر درخواست
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">
          همه تغییرات از زمان ثبت تا وضعیت فعلی
        </p>
      </div>

      {timeline.length > 0 ? (
        <ol className="relative space-y-1 before:absolute before:bottom-5 before:right-[7px] before:top-5 before:w-px before:bg-slate-200">
          {timeline.map((item) => {
            const eventProgress = item.to_progress_percent ?? item.progress_percent;
            const files = attachmentNames(item);
            return (
              <li key={item.id} className="relative flex gap-4 pb-5">
                <span
                  className={
                    "relative z-[1] mt-2 h-3.5 w-3.5 shrink-0 rounded-full ring-4 " +
                    timelineEventDotClass(item)
                  }
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-foreground">{timelineEventLabel(item)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.event_type === "referred" && item.to_user_name ? (
                          <>
                            از{" "}
                            <span className="font-semibold text-foreground">
                              {item.actor_name || "سامانه"}
                            </span>{" "}
                            به{" "}
                            <span className="font-semibold text-violet-700">
                              {item.to_user_name}
                            </span>
                          </>
                        ) : (
                          <>توسط {item.actor_name || "سامانه"}</>
                        )}
                      </p>
                    </div>
                    <time className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatPersianDateTime(item.created_at)}
                    </time>
                  </div>

                  {(eventProgress !== null || item.note || files.length > 0) && (
                    <div className="mt-3 flex flex-wrap items-start gap-2">
                      {eventProgress !== null && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                          پیشرفت: {normalizedProgress(eventProgress).toLocaleString("fa-IR")}٪
                        </span>
                      )}
                      {item.note && (
                        <p className="min-w-0 flex-1 whitespace-pre-wrap rounded-xl bg-muted/40 px-3 py-2 text-xs leading-6 text-muted-foreground">
                          {item.note}
                        </p>
                      )}
                      {files.map((fileName, index) => (
                        <Button
                          key={`${fileName}-${index}`}
                          type="button"
                          onClick={() => void downloadAttachment(item, index, fileName)}
                          className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                        >
                          <Paperclip size={12} />
                          {fileName}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-center text-sm text-muted-foreground">
          هنوز رویدادی برای این درخواست ثبت نشده است.
        </div>
      )}
    </section>
  );
}
