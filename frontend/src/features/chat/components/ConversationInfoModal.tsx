import { useState } from "react";
import { Archive, Check, Pin, Plus, UserPlus, Users, Volume2, VolumeX, X } from "lucide-react";

import UserAvatar from "@/components/UserAvatar";
import UserDisplayName from "@/components/UserDisplayName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUserDisplayName } from "@/lib/userDisplay";

import { chatService, type ChatUser, type Conversation } from "../api/chat-service";
import { errorText } from "../utils";
import { Modal } from "./Modal";
export function ConversationInfoModal({
  conversation,
  users,
  currentUserId,
  onClose,
  onChanged,
  onSetting,
  onError,
}: {
  conversation: Conversation;
  users: ChatUser[];
  currentUserId: number;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onSetting: (
    value: Partial<
      Pick<Conversation, "is_muted" | "is_pinned" | "is_archived">
    >,
  ) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const [previewAvatar, setPreviewAvatar] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const availableUsers = users.filter(
    (item) => !conversation.members.some((member) => member.id === item.id),
  );
  const otherMember =
    conversation.kind === "direct"
      ? conversation.members.find((member) => member.id !== currentUserId) ||
        conversation.members[0]
      : null;
  const headerAvatarUrl = otherMember?.avatar_url || "";

  const rename = async () => {
    if (!title.trim() || title.trim() === conversation.title) return;
    try {
      await chatService.renameGroup(conversation.id, title);
      await onChanged();
    } catch (error) {
      onError(errorText(error));
    }
  };

  const openAvatarPreview = (name: string, avatarUrl?: string | null) => {
    if (!avatarUrl) return;
    const url = avatarUrl.startsWith("/avatars/")
      ? `/api/v1${avatarUrl}`
      : avatarUrl;
    setPreviewAvatar({ name, url });
  };

  return (
    <Modal title="جزئیات گفتگو" onClose={onClose}>
      <div className="max-h-[70vh] overflow-y-auto p-5">
        <div className="mb-5 flex flex-col items-center">
          {conversation.kind === "group" ? (
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-2xl font-bold text-white">
              <Users size={30} />
            </span>
          ) : (
            <Button variant="ghost"
              type="button"
              disabled={!headerAvatarUrl}
              onClick={() =>
                openAvatarPreview(
                  otherMember?.display_name ||
                    otherMember?.username ||
                    conversation.title,
                  headerAvatarUrl,
                )
              }
              className={`rounded-3xl ${headerAvatarUrl ? "cursor-zoom-in" : "cursor-default"}`}
              title={headerAvatarUrl ? "مشاهده تصویر پروفایل" : undefined}
            >
              <UserAvatar
                name={
                  otherMember?.display_name ||
                  otherMember?.username ||
                  conversation.title
                }
                avatarUrl={headerAvatarUrl || null}
                className="h-20 w-20 rounded-3xl text-2xl"
                fallbackClassName="bg-primary text-white"
              />
            </Button>
          )}
          {conversation.kind === "group" &&
          conversation.role === "owner" ? (
            <div className="mt-3 flex w-full max-w-xs gap-2">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-center font-bold outline-none"
              />
              <Button variant="ghost"
                type="button"
                onClick={() => void rename()}
                className="rounded-xl bg-muted p-2.5 text-muted-foreground"
              >
                <Check size={18} />
              </Button>
            </div>
          ) : (
            <p className="mt-3 font-extrabold text-foreground">
              {conversation.title}
            </p>
          )}
          {conversation.kind === "direct" && otherMember?.job_title && (
            <p className="mt-1 text-sm text-muted-foreground">{otherMember.job_title}</p>
          )}
        </div>
        <div className="mb-5 grid grid-cols-3 gap-2">
          <Button variant="ghost"
            type="button"
            onClick={() =>
              void onSetting({ is_muted: !conversation.is_muted })
            }
            className="flex flex-col items-center gap-2 rounded-2xl bg-muted/40 p-3 text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary"
          >
            {conversation.is_muted ? (
              <Volume2 size={20} />
            ) : (
              <VolumeX size={20} />
            )}
            {conversation.is_muted ? "با صدا" : "بی‌صدا"}
          </Button>
          <Button variant="ghost"
            type="button"
            onClick={() =>
              void onSetting({ is_pinned: !conversation.is_pinned })
            }
            className="flex flex-col items-center gap-2 rounded-2xl bg-muted/40 p-3 text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary"
          >
            <Pin size={20} />
            {conversation.is_pinned ? "برداشتن سنجاق" : "سنجاق"}
          </Button>
          <Button variant="ghost"
            type="button"
            onClick={() => {
              void onSetting({ is_archived: !conversation.is_archived });
              onClose();
            }}
            className="flex flex-col items-center gap-2 rounded-2xl bg-muted/40 p-3 text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary"
          >
            <Archive size={20} />
            {conversation.is_archived ? "بازگردانی" : "بایگانی"}
          </Button>
        </div>
        {conversation.kind === "group" && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">
                اعضا ({conversation.members.length.toLocaleString("fa-IR")})
              </p>
              {conversation.role === "owner" && availableUsers.length > 0 && (
                <Button variant="ghost"
                  type="button"
                  onClick={() => setAddOpen((value) => !value)}
                  className="flex items-center gap-1 text-xs font-bold text-primary"
                >
                  <UserPlus size={15} />
                  افزودن عضو
                </Button>
              )}
            </div>
            {addOpen && (
              <div className="mb-3 max-h-40 overflow-y-auto rounded-2xl border p-2">
                {availableUsers.map((item) => (
                  <Button variant="ghost"
                    type="button"
                    key={item.id}
                    onClick={async () => {
                      try {
                        await chatService.addParticipants(conversation.id, [
                          item.id,
                        ]);
                        setAddOpen(false);
                        await onChanged();
                      } catch (error) {
                        onError(errorText(error));
                      }
                    }}
                    className="flex w-full items-center gap-2 rounded-xl p-2 text-right text-sm hover:bg-muted/40"
                  >
                    <Plus size={15} className="text-primary" />
                    <UserDisplayName user={item} />
                  </Button>
                ))}
              </div>
            )}
            <div className="space-y-1">
              {conversation.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-muted/40"
                >
                  <Button variant="ghost"
                    type="button"
                    disabled={!member.avatar_url}
                    onClick={() =>
                      openAvatarPreview(
                        formatUserDisplayName(member),
                        member.avatar_url,
                      )
                    }
                    className={member.avatar_url ? "cursor-zoom-in" : "cursor-default"}
                    title={member.avatar_url ? "مشاهده تصویر پروفایل" : undefined}
                  >
                    <UserAvatar
                      name={formatUserDisplayName(member)}
                      avatarUrl={member.avatar_url}
                      className="h-9 w-9 rounded-xl"
                    />
                  </Button>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      <UserDisplayName user={member} />
                      {member.id === currentUserId ? " (شما)" : ""}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {member.role === "owner"
                        ? "سازنده گروه"
                        : member.department}
                    </span>
                  </span>
                  {conversation.role === "owner" &&
                    member.role !== "owner" && (
                      <Button variant="ghost"
                        type="button"
                        title="حذف از گروه"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `${formatUserDisplayName(member)} از گروه حذف شود؟`,
                            )
                          )
                            return;
                          try {
                            await chatService.removeParticipant(
                              conversation.id,
                              member.id,
                            );
                            await onChanged();
                          } catch (error) {
                            onError(errorText(error));
                          }
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      >
                        <X size={16} />
                      </Button>
                    )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {previewAvatar && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <Button variant="ghost"
            type="button"
            aria-label="بستن تصویر"
            onClick={() => setPreviewAvatar(null)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col items-center">
            <img
              src={previewAvatar.url}
              alt={previewAvatar.name}
              className="max-h-[70vh] w-full rounded-3xl object-contain shadow-2xl"
            />
            <p className="mt-3 text-sm font-bold text-white">
              {previewAvatar.name}
            </p>
            <Button variant="ghost"
              type="button"
              onClick={() => setPreviewAvatar(null)}
              className="mt-3 rounded-xl bg-card/15 px-4 py-2 text-sm font-semibold text-white hover:bg-card/25"
            >
              بستن
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
