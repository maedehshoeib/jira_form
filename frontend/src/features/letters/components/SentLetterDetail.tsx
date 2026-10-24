"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Paperclip } from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import TaskConversation from "@/components/tasks/TaskConversation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/portal";
import { useAuth } from "@/context/AuthContext";
import { formatPersianDate } from "@/lib/persianDate";
import { cn } from "@/lib/utils";
import { LETTER_NO_ACTION_VALUE, type SubmissionDetail } from "@/features/tasks";

import { downloadAuthFile } from "../download";
import type { LetterFolder } from "../letterFolders";
import {
  sentAttachmentNames,
  sentIsOverdue,
  sentPrimarySubmissionId,
  sentReadSummary,
  sentStatusLabel,
  type SentLetter,
} from "../sentLetters";
import { LetterFinishPanel } from "./LetterFinishPanel";
import { LetterFolderAssign } from "./LetterFolderAssign";
import { LetterReferForm } from "./LetterReferForm";
import { LetterWorkflowHistory } from "./LetterWorkflowHistory";
import { SentRecipientRow } from "./SentRecipientRow";

function letterSender(letter: SentLetter) {
  const sender = (letter.sender || "").trim();
  const detail = (letter.sender_detail || "").trim();
  if (sender === "هلدینگ" && detail) return `هلدینگ / ${detail}`;
  return sender || letter.sent_by;
}

type Props = {
  letter: SentLetter;
  folders: LetterFolder[];
  onFoldersChanged: () => void;
  onLetterChanged: () => void;
};

export function SentLetterDetail({
  letter,
  folders,
  onFoldersChanged,
  onLetterChanged,
}: Props) {
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<SubmissionDetail | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [referSubmissionId, setReferSubmissionId] = useState<number | null>(null);
  const [referLoading, setReferLoading] = useState(false);
  const attachments = sentAttachmentNames(letter);
  const read = sentReadSummary(letter);
  const historySubmissionId = sentPrimarySubmissionId(letter);
  const canFinish = Boolean(user && letter.sent_by_id === user.id);
  // Admins monitor every letter with the same task toolkit: refer, re-refer,
  // conversation and reminders. Closing stays with the sender (as with tasks).
  const canFollowUp = canFinish || Boolean(user?.is_admin);
  const canRefer = canFollowUp && letter.needs_action !== LETTER_NO_ACTION_VALUE;
  const meta = [
    {
      label: "شماره نامه",
      value: letter.system_letter_number || letter.letter_number || "—",
      dir: "ltr" as const,
    },
    { label: "تاریخ ارسال", value: formatPersianDate(letter.created_at) || "—" },
    { label: "فرستنده", value: letterSender(letter) },
    { label: "مهلت انجام", value: letter.due_date || "—" },
  ];

  useEffect(() => {
    if (!historySubmissionId) {
      setHistory(null);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    void client
      .get<SubmissionDetail>(`${endpoints.submissions}/${historySubmissionId}`)
      .then(({ data }) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) {
          setHistory(null);
          setError("بارگذاری تاریخچه نامه با مشکل مواجه شد.");
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [historySubmissionId, letter.batch_id, historyVersion]);

  const download = async (index: number, name: string) => {
    if (!historySubmissionId) return;
    const ok = await downloadAuthFile(
      `${API_BASE}/submissions/${historySubmissionId}/attachment?index=${index}`,
      name,
    );
    setError(ok ? "" : "دانلود پیوست با مشکل مواجه شد.");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="max-w-3xl text-xl font-extrabold leading-8 text-foreground">
          {letter.subject || "نامه"}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">
            {letter.letter_type === "internal" ? "نامه داخلی" : "نامه برون‌سازمانی"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              sentIsOverdue(letter)
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-slate-200 bg-slate-50 text-slate-700",
            )}
          >
            {sentStatusLabel(letter)}
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            خوانده‌شده {read.read.toLocaleString("fa-IR")} از {read.total.toLocaleString("fa-IR")}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-muted/40 px-4 py-3 sm:grid-cols-2 xl:grid-cols-4">
        {meta.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground">{item.label}</p>
            <p
              dir={item.dir}
              className="mt-1 truncate text-sm font-bold text-foreground"
              title={item.value}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {error}
        </div>
      )}

      <LetterFolderAssign
        scope="sent"
        folders={folders}
        batchId={letter.batch_id}
        onChanged={onFoldersChanged}
        onError={setError}
      />

      <LetterFinishPanel
        letter={letter}
        canFinish={canFinish}
        onUpdated={() => {
          setHistoryVersion((value) => value + 1);
          onLetterChanged();
        }}
      />

      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {letter.description ? (
          <div className="whitespace-pre-wrap text-sm leading-8 text-foreground">
            {letter.description}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">متن نامه ثبت نشده است.</p>
        )}
        {attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
            {attachments.map((name, index) => (
              <Button
                key={`${name}-${index}`}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void download(index, name)}
                className="h-8 gap-1.5 rounded-lg text-xs"
              >
                <Paperclip size={12} />
                <span className="max-w-48 truncate">{name}</span>
                <Download size={12} className="text-primary" />
              </Button>
            ))}
          </div>
        )}
      </article>

      <section className="rounded-2xl border border-border bg-card">
        <h4 className="border-b border-border px-4 py-3 text-sm font-bold text-foreground">
          گیرندگان و پیگیری
        </h4>
        <ul className="divide-y divide-border">
          {letter.recipients.map((row) => {
            const referOpen = referSubmissionId === row.submission_id;
            return (
              <SentRecipientRow
                key={row.submission_id}
                row={row}
                canRefer={canRefer}
                referOpen={referOpen}
                onToggleRefer={() =>
                  setReferSubmissionId(referOpen ? null : row.submission_id)
                }
              >
                {referOpen ? (
                  <LetterReferForm
                    submissionId={row.submission_id}
                    apiScope="submissions"
                    title={`ارجاع مجدد نامه (گیرنده: ${row.display_name})`}
                    previouslyReferredIds={row.user_id ? [row.user_id] : []}
                    allowRepeat
                    actionLoading={referLoading}
                    onActionLoading={setReferLoading}
                    onError={setError}
                    onReferred={() => {
                      setReferSubmissionId(null);
                      setHistoryVersion((value) => value + 1);
                      onLetterChanged();
                    }}
                    onClose={() => setReferSubmissionId(null)}
                  />
                ) : null}
              </SentRecipientRow>
            );
          })}
        </ul>
      </section>

      {historySubmissionId ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <TaskConversation submissionId={historySubmissionId} canRemind={canFollowUp} />
        </section>
      ) : null}

      {historyLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-10 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          در حال بارگذاری تاریخچه نامه…
        </div>
      ) : history ? (
        <LetterWorkflowHistory
          submissionId={history.id}
          apiScope="submissions"
          timeline={history.timeline}
          referrals={history.referrals}
          assigneeProgress={history.assignee_progress}
          ccRecipients={history.cc_recipients}
          statusNote={history.status_note}
          statusAttachmentName={history.status_attachment_name}
          onError={setError}
        />
      ) : null}
    </div>
  );
}
