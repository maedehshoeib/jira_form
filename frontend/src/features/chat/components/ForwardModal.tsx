import { useState } from "react";
import { Check, Forward, Loader2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

import { chatService, type ChatMessage, type Conversation } from "../api/chat-service";
import { errorText, initials } from "../utils";
import { Modal } from "./Modal";
export function ForwardModal({
  message,
  conversations,
  onClose,
  onDone,
  onError,
}: {
  message: ChatMessage;
  conversations: Conversation[];
  onClose: () => void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    setSubmitting(true);
    try {
      await chatService.forwardMessage(message.id, selected);
      onDone();
    } catch (error) {
      onError(errorText(error));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal title="هدایت پیام" onClose={onClose}>
      <div className="max-h-[55vh] overflow-y-auto p-3">
        {conversations.map((item) => {
          const checked = selected.includes(item.id);
          return (
            <Button variant="ghost"
              type="button"
              key={item.id}
              onClick={() =>
                setSelected((values) =>
                  checked
                    ? values.filter((id) => id !== item.id)
                    : [...values, item.id],
                )
              }
              className="flex w-full items-center gap-3 rounded-2xl p-3 hover:bg-muted/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">
                {item.kind === "group" ? (
                  <Users size={18} />
                ) : (
                  initials(item.title)
                )}
              </span>
              <span className="flex-1 text-right text-sm font-bold">
                {item.title}
              </span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                  checked ? "border-red-600 bg-primary text-white" : ""
                }`}
              >
                {checked && <Check size={13} />}
              </span>
            </Button>
          );
        })}
      </div>
      <div className="flex justify-end border-t p-4">
        <Button variant="ghost"
          type="button"
          disabled={!selected.length || submitting}
          onClick={() => void submit()}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Forward size={16} />
          )}
          هدایت
        </Button>
      </div>
    </Modal>
  );
}
