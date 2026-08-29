import { useEffect, useMemo, useState } from "react";
import { AtSign, BellRing, Loader2, MessageCircle, Send } from "lucide-react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { formatPersianDateTime } from "../../lib/persianDate";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

type ConversationUser = {
  id: number;
  username: string;
  display_name: string;
};

type CommentItem = {
  id: number;
  author_id: number;
  author_name: string;
  body: string;
  mentions: ConversationUser[];
  created_at: string;
};

type ReminderItem = {
  id: number;
  sender_name: string;
  recipient_name: string;
  message: string;
  created_at: string;
};

type Conversation = {
  participants: ConversationUser[];
  comments: CommentItem[];
  reminders: ReminderItem[];
};

function parseConversation(value: unknown): Conversation {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid conversation response");
  }
  const candidate = value as Partial<Conversation>;
  if (
    !Array.isArray(candidate.participants) ||
    !Array.isArray(candidate.comments) ||
    !Array.isArray(candidate.reminders)
  ) {
    throw new Error("Invalid conversation response");
  }
  return {
    participants: candidate.participants,
    comments: candidate.comments,
    reminders: candidate.reminders,
  };
}

export default function TaskConversation({
  submissionId,
  canRemind = false,
}: {
  submissionId: number;
  canRemind?: boolean;
}) {
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [body, setBody] = useState("");
  const [mentionIds, setMentionIds] = useState<number[]>([]);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setConversation(null);
    client
      .get<unknown>(endpoints.taskConversation(submissionId))
      .then(({ data }) => {
        const parsed = parseConversation(data);
        if (active) setConversation(parsed);
      })
      .catch(() => active && setError("دریافت گفت‌وگوی درخواست با مشکل مواجه شد."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [submissionId]);

  const mentionMatch = body.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = (mentionMatch?.[1] ?? "").toLocaleLowerCase("fa");
  const mentionCandidates = useMemo(() => {
    if (!mentionMatch) return [];
    return (conversation?.participants ?? [])
      .filter((participant) => participant.id !== user?.id)
      .filter((participant) => !mentionIds.includes(participant.id))
      .filter((participant) => {
        if (!mentionQuery) return true;
        return `${participant.display_name} ${participant.username}`
          .toLocaleLowerCase("fa")
          .includes(mentionQuery);
      })
      .slice(0, 6);
  }, [conversation?.participants, mentionIds, mentionMatch, mentionQuery, user?.id]);

  const addMention = (participant: ConversationUser) => {
    setBody((current) =>
      current.replace(/(?:^|\s)@[^\s@]*$/, (match) => {
        const prefix = match.startsWith(" ") ? " " : "";
        return `${prefix}@${participant.display_name} `;
      }),
    );
    setMentionIds((current) => [...current, participant.id]);
  };

  const sendComment = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await client.post<unknown>(
        endpoints.taskComments(submissionId),
        { body: body.trim(), mention_user_ids: mentionIds },
      );
      setConversation(parseConversation(data));
      setBody("");
      setMentionIds([]);
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
    } catch {
      setError("ارسال پیام انجام نشد. دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReminder = async () => {
    setSubmitting(true);
    setError("");
    try {
      const { data } = await client.post<unknown>(
        endpoints.taskReminders(submissionId),
        { message: reminderMessage.trim() },
      );
      setConversation(parseConversation(data));
      setReminderMessage("");
      setReminderOpen(false);
    } catch {
      setError("ارسال یادآوری انجام نشد. برای این درخواست باید مسئول فعالی وجود داشته باشد.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-muted/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 font-bold text-foreground">
            <MessageCircle size={19} className="text-sky-600" />
            گفت‌وگوی درخواست
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            فرستنده، مسئولان، ارجاع‌گیرندگان و افراد رونوشت‌شده می‌توانند پیام بگذارند و یکدیگر را با @ خطاب کنند.
          </p>
        </div>
        {canRemind && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setReminderOpen((open) => !open)}
            className="gap-2 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
          >
            <BellRing size={16} />
            یادآوری به مسئولان
          </Button>
        )}
      </div>

      {reminderOpen && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <Textarea
            value={reminderMessage}
            onChange={(event) => setReminderMessage(event.target.value)}
            placeholder="متن یادآوری (اختیاری)"
            maxLength={512}
            className="min-h-16 bg-card"
          />
          <Button type="button" onClick={() => void sendReminder()} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
            ارسال زنگ یادآوری
          </Button>
        </div>
      )}

      {(conversation?.reminders.length ?? 0) > 0 && (
        <div className="space-y-2">
          {conversation?.reminders.map((reminder) => (
            <div key={reminder.id} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <div className="flex flex-wrap items-center gap-1 font-semibold">
                <BellRing size={13} />
                یادآوری از {reminder.sender_name} به {reminder.recipient_name}
              </div>
              {reminder.message && <p className="mt-1 whitespace-pre-wrap">{reminder.message}</p>}
              <p className="mt-1 text-amber-700">{formatPersianDateTime(reminder.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> در حال دریافت پیام‌ها...
          </div>
        ) : conversation?.comments.length ? (
          conversation.comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-xl border px-3 py-2 text-sm ${
                comment.author_id === user?.id
                  ? "mr-6 border-sky-100 bg-sky-50"
                  : "ml-6 border-border bg-card"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-foreground">{comment.author_name}</span>
                <span className="text-muted-foreground">{formatPersianDateTime(comment.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{comment.body}</p>
              {comment.mentions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {comment.mentions.map((mention) => (
                    <span key={mention.id} className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                      @{mention.display_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">هنوز پیامی ثبت نشده است.</p>
        )}
      </div>

      <div className="relative space-y-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="پیام خود را بنویسید؛ برای خطاب‌کردن افراد @ را تایپ کنید..."
          maxLength={2000}
          className="min-h-24 bg-card"
        />
        {mentionMatch && (
          <div className="absolute bottom-full z-20 mb-1 max-h-44 w-full overflow-y-auto rounded-xl border border-sky-200 bg-card p-1 shadow-lg">
            {mentionCandidates.length ? mentionCandidates.map((participant) => (
              <Button
                key={participant.id}
                type="button"
                onClick={() => addMention(participant)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm hover:bg-sky-50"
              >
                <AtSign size={14} className="text-sky-600" />
                <span className="font-semibold text-foreground">{participant.display_name}</span>
                <span className="text-xs text-muted-foreground">{participant.username}</span>
              </Button>
            )) : (
              <p className="px-3 py-3 text-xs text-muted-foreground">شرکت‌کننده‌ای یافت نشد.</p>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{body.length.toLocaleString("fa-IR")} از ۲۰۰۰</span>
          <Button type="button" onClick={() => void sendComment()} disabled={submitting || !body.trim()} className="gap-2">
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            ارسال پیام
          </Button>
        </div>
      </div>
      {error && <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary">{error}</p>}
    </section>
  );
}
