import { useState } from "react";
import { Check, Loader2, Search } from "lucide-react";

import UserAvatar from "@/components/UserAvatar";
import UserDisplayName from "@/components/UserDisplayName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUserDisplayName } from "@/lib/userDisplay";

import { chatService, type ChatUser, type Conversation } from "../api/chat-service";
import { errorText } from "../utils";
import { Modal } from "./Modal";
export function NewConversationModal({
  users,
  onClose,
  onCreated,
  onError,
}: {
  users: ChatUser[];
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
  onError: (message: string) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const filtered = users.filter((item) => {
    const term = search.trim().toLocaleLowerCase("fa");
    return (
      !term ||
      item.display_name.toLocaleLowerCase("fa").includes(term) ||
      item.username.toLocaleLowerCase().includes(term) ||
      item.department.toLocaleLowerCase("fa").includes(term)
    );
  });

  const create = async () => {
    if (!selected.length || (group && !title.trim())) return;
    setSubmitting(true);
    try {
      const result = await chatService.createConversation(
        selected,
        group || selected.length > 1 ? "group" : "direct",
        title,
      );
      onCreated(result);
    } catch (error) {
      onError(errorText(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="گفتگوی جدید" onClose={onClose}>
      <div className="p-4">
        <div className="mb-3 flex rounded-2xl bg-muted p-1">
          <Button variant="ghost"
            type="button"
            onClick={() => {
              setGroup(false);
              setSelected((items) => items.slice(0, 1));
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
              !group ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
            }`}
          >
            گفتگوی شخصی
          </Button>
          <Button variant="ghost"
            type="button"
            onClick={() => setGroup(true)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
              group ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
            }`}
          >
            ساخت گروه
          </Button>
        </div>
        {group && (
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={256}
            placeholder="نام گروه"
            className="mb-3 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-red-300"
          />
        )}
        <Label className="flex items-center gap-2 rounded-xl border px-3 py-2.5">
          <Search size={17} className="text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجوی نام، واحد یا نام کاربری"
            className="flex-1 text-sm outline-none"
          />
        </Label>
      </div>
      <div className="max-h-[45vh] overflow-y-auto border-y p-2">
        {filtered.map((item) => {
          const checked = selected.includes(item.id);
          return (
            <Button variant="ghost"
              key={item.id}
              type="button"
              onClick={() =>
                setSelected((items) =>
                  checked
                    ? items.filter((id) => id !== item.id)
                    : group
                      ? [...items, item.id]
                      : [item.id],
                )
              }
              className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-right hover:bg-muted/40"
            >
              <UserAvatar
                name={formatUserDisplayName(item)}
                avatarUrl={item.avatar_url}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-foreground">
                  <UserDisplayName user={item} />
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {[item.job_title, item.department].filter(Boolean).join(" • ")}
                </span>
              </span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                  checked
                    ? "border-red-600 bg-primary text-white"
                    : "border-border"
                }`}
              >
                {checked && <Check size={13} />}
              </span>
            </Button>
          );
        })}
      </div>
      <div className="flex items-center justify-between p-4">
        <span className="text-xs text-muted-foreground">
          {selected.length.toLocaleString("fa-IR")} نفر انتخاب شده
        </span>
        <Button variant="ghost"
          type="button"
          onClick={() => void create()}
          disabled={
            !selected.length || (group && !title.trim()) || submitting
          }
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          ایجاد گفتگو
        </Button>
      </div>
    </Modal>
  );
}
