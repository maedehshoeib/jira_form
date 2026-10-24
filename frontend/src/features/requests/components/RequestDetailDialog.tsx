"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import TaskConversation from "@/components/tasks/TaskConversation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormTemplate } from "@/config/portal";
import { useAuth } from "@/context/AuthContext";
import { LETTER_NO_ACTION_VALUE } from "@/features/tasks";

import type { SubmissionDetail } from "../types";
import { requestDisplayTitle, workflowStatusMeta } from "../utils";
import { AssigneeProgressList } from "./AssigneeProgressList";
import { RequestFieldValue } from "./RequestFieldValue";
import { RequestFinalStatusPanel } from "./RequestFinalStatusPanel";
import { RequestInfoGrid } from "./RequestInfoGrid";
import { RequestReferPanel } from "./RequestReferPanel";
import { RequestTimeline } from "./RequestTimeline";
import { WorkflowOverview, WorkflowStatusIcon } from "./RequestWorkflowOverview";

const HIDDEN_FIELDS = new Set([
  "_report_id",
  "attachment",
  "attachments",
  "_attachments",
  "letter_batch_id",
  "letter_type",
  "recipient_id",
  "recipient_name",
]);

type RequestDetailDialogProps = {
  submissionId: number;
  onClose: () => void;
  /** Called after refer / close / reopen so the caller can refresh its list. */
  onChanged?: (updated: SubmissionDetail) => void;
};

function useRequestDetail(submissionId: number) {
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    client
      .get<SubmissionDetail>(`${endpoints.submissions}/${submissionId}`)
      .then(({ data }) => {
        if (cancelled) return;
        setDetail(data);
        // Historical details remain available if form access changed or the
        // original template is no longer available.
        client
          .get<FormTemplate>(`${endpoints.forms}/${data.form_id}`, {
            params: { department: data.department_id, section: data.section_id },
          })
          .then((response) => {
            if (!cancelled) setTemplate(response.data);
          })
          .catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) setError("نمایش جزئیات این درخواست با مشکل مواجه شد.");
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  return { detail, setDetail, template, error };
}

export function RequestDetailDialog({
  submissionId,
  onClose,
  onChanged,
}: RequestDetailDialogProps) {
  const { user } = useAuth();
  const { detail, setDetail, template, error } = useRequestDetail(submissionId);

  const visibleFields = useMemo(() => {
    if (!detail) return [];
    const isInternalLetter =
      detail.form_id === "management-letter-form" && detail.data.letter_type === "internal";
    const fieldsByName = new Map(template?.fields.map((field) => [field.name, field]));
    return Object.entries(detail.data)
      .filter(([name, value]) => {
        if (HIDDEN_FIELDS.has(name)) return false;
        if (
          isInternalLetter &&
          (name === "letter_number" || name === "sender" || name === "sender_detail")
        ) {
          return false;
        }
        const empty = value == null || String(value).trim() === "";
        return !((name === "sender_detail" || name === "due_date") && empty);
      })
      .map(([name, value]) => ({ name, value, field: fieldsByName.get(name) }));
  }, [detail, template]);

  const applyUpdate = (updated: SubmissionDetail) => {
    setDetail((previous) => (previous ? { ...updated, data: previous.data } : updated));
    onChanged?.(updated);
  };

  if (!detail) {
    return (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/20"
        onMouseDown={onClose}
      >
        <div
          className="flex items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {error ? (
            <>
              <span className="text-sm font-semibold text-primary">{error}</span>
              <Button variant="outline" size="sm" onClick={onClose}>
                بستن
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="animate-spin text-primary" />
              در حال دریافت جزئیات...
            </>
          )}
        </div>
      </div>
    );
  }

  const statusMeta = workflowStatusMeta(detail.workflow_status);
  const isSender = detail.submitted_by_username === user?.username;
  const isMeetingRoom = detail.form_id === "meeting-room-reservation-form";
  // Inform-only letters (جهت اطلاع) are read-only: nothing to refer or close.
  const isInformOnly = detail.needs_action === LETTER_NO_ACTION_VALUE;
  const canRefer =
    !isMeetingRoom &&
    !isInformOnly &&
    (detail.status === "submitted" || detail.status === "in_progress");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="جزئیات درخواست"
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card/95 p-6 backdrop-blur">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                aria-label={"وضعیت درخواست: " + statusMeta.label}
                className={"gap-1.5 " + statusMeta.badgeClass}
              >
                <WorkflowStatusIcon status={detail.workflow_status} />
                {statusMeta.label}
              </Badge>
              <span className="text-xs text-muted-foreground">شناسه درخواست: {detail.id}</span>
            </div>
            <h3 className="break-words text-2xl font-bold text-foreground [overflow-wrap:anywhere]">
              {requestDisplayTitle(detail)}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.department_title} / {detail.section_title || detail.form_title}
            </p>
          </div>
          <Button variant="outline" onClick={onClose} className="shrink-0 rounded-xl">
            بستن
          </Button>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <WorkflowOverview status={detail.workflow_status} />

          {!isMeetingRoom && !isInformOnly && isSender && (
            <RequestFinalStatusPanel selected={detail} onUpdated={applyUpdate} />
          )}
          {canRefer && <RequestReferPanel selected={detail} onUpdated={applyUpdate} />}

          <section
            aria-label="میزان پیشرفت رسیدگی"
            className="rounded-3xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="mb-4">
              <h4 className="font-bold text-foreground">پیشرفت هر مسئول رسیدگی</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                درصد پیشرفت هر فرد به‌صورت جداگانه نمایش داده می‌شود.
              </p>
            </div>
            {(detail.assignee_progress?.length ?? 0) > 0 ? (
              <AssigneeProgressList items={detail.assignee_progress ?? []} />
            ) : (
              <p className="text-sm text-muted-foreground">هنوز پیشرفتی ثبت نشده است.</p>
            )}
          </section>

          <RequestInfoGrid detail={detail} showSubmitter={Boolean(user?.is_admin)} />

          <TaskConversation submissionId={detail.id} canRemind />
          <RequestTimeline submissionId={detail.id} timeline={detail.timeline ?? []} />

          <div className="space-y-4">
            {visibleFields.map(({ name, value, field }) => (
              <div key={name} className="rounded-2xl border border-border p-4">
                <div className="mb-2 text-sm font-semibold text-muted-foreground">
                  {field?.label ?? name}
                </div>
                <div className="text-foreground">
                  <RequestFieldValue value={value} field={field} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
