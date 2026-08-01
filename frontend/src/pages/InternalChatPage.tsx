import {
  Archive,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  File as FileIcon,
  Forward,
  Loader2,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AppShell from "../components/layout/AppShell";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";
import {
  ChatMessage,
  ChatUser,
  Conversation,
  chatService,
} from "../services/chat.service";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "؟"
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(`${value.endsWith("Z") ? value : `${value}Z`}`));
}

function formatListTime(value: string) {
  const date = new Date(`${value.endsWith("Z") ? value : `${value}Z`}`);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return formatTime(value);
  return new Intl.DateTimeFormat("fa-IR", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function fileSize(value: number) {
  if (value < 1024) return `${value.toLocaleString("fa-IR")} بایت`;
  if (value < 1024 * 1024)
    return `${Math.ceil(value / 1024).toLocaleString("fa-IR")} کیلوبایت`;
  return `${(value / 1024 / 1024).toLocaleString("fa-IR", {
    maximumFractionDigits: 1,
  })} مگابایت`;
}

function errorText(error: unknown) {
  const candidate = error as {
    response?: { data?: { detail?: string | { msg?: string }[] } };
  };
  const detail = candidate.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail[0]?.msg || "درخواست نامعتبر است";
  return "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";
}

type ModalProps = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

function Modal({ title, children, onClose }: ModalProps) {
  useEffect(() => {
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="بستن"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
      />
      <section className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-bold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function InternalChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [reactionMessageId, setReactionMessageId] = useState<number | null>(null);
  const [typingText, setTypingText] = useState("");
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef(0);
  const typingSentAtRef = useRef(0);

  const active = conversations.find((item) => item.id === activeId) || null;
  activeIdRef.current = activeId;

  const loadConversations = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const data = await chatService.conversations(showArchived);
        setConversations(data);
        setActiveId((current) => {
          if (current && data.some((item) => item.id === current)) return current;
          return data[0]?.id ?? null;
        });
        setError("");
      } catch (requestError) {
        setError(errorText(requestError));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [showArchived],
  );

  const loadMessages = useCallback(
    async (conversationId: number, quiet = false, search = "") => {
      if (!quiet) setMessagesLoading(true);
      try {
        const data = await chatService.messages(
          conversationId,
          undefined,
          search,
        );
        if (activeIdRef.current !== conversationId) return;
        setMessages(data.items);
        setHasMore(data.has_more);
        if (!search) void chatService.markRead(conversationId);
        setConversations((items) =>
          items.map((item) =>
            item.id === conversationId ? { ...item, unread_count: 0 } : item,
          ),
        );
      } catch (requestError) {
        setError(errorText(requestError));
      } finally {
        if (!quiet) setMessagesLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void Promise.all([
      loadConversations(),
      chatService.users().then(setUsers).catch(() => setUsers([])),
    ]);
  }, [loadConversations]);

  useEffect(() => {
    setMessages([]);
    setReplyingTo(null);
    setEditing(null);
    setTypingText("");
    setMessageSearch("");
    setShowMessageSearch(false);
    if (activeId) void loadMessages(activeId, false, "");
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeId || !showMessageSearch) return;
    const timer = window.setTimeout(
      () => void loadMessages(activeId, false, messageSearch),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [messageSearch, showMessageSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!messagesLoading && !messageSearch) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, messagesLoading, messageSearch]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    let socket: WebSocket | null = null;
    let retryTimer = 0;
    let pollTimer = 0;
    let disposed = false;

    const refresh = (conversationId?: number) => {
      void loadConversations(true);
      if (conversationId && conversationId === activeIdRef.current) {
        void loadMessages(conversationId, true, "");
      }
    };
    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${protocol}//${window.location.host}/api/v1/chat/ws?token=${encodeURIComponent(token)}`,
      );
      socketRef.current = socket;
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type: string;
            conversation_id?: number;
          };
          if (
            payload.type === "typing" &&
            payload.conversation_id === activeIdRef.current
          ) {
            const typingPayload = payload as typeof payload & {
              user_id?: number;
              user_name?: string;
            };
            if (typingPayload.user_id !== user?.id) {
              setTypingText(`${typingPayload.user_name || "همکار شما"} در حال نوشتن است...`);
              window.clearTimeout(typingTimerRef.current);
              typingTimerRef.current = window.setTimeout(
                () => setTypingText(""),
                2200,
              );
            }
          } else if (payload.type === "conversation.read") {
            // Refresh read receipts without re-marking the same conversation.
            void loadConversations(true);
          } else if (payload.type !== "pong") {
            refresh(payload.conversation_id);
          }
        } catch {
          // Ignore malformed server notifications; polling remains active.
        }
      };
      socket.onclose = () => {
        if (!disposed) retryTimer = window.setTimeout(connect, 3000);
      };
    };
    connect();
    pollTimer = window.setInterval(
      () => refresh(activeIdRef.current || undefined),
      12000,
    );
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pollTimer);
      socket?.close();
      socketRef.current = null;
      window.clearTimeout(typingTimerRef.current);
    };
  }, [loadConversations, loadMessages, user?.id]);

  const filteredConversations = useMemo(() => {
    const term = conversationSearch.trim().toLocaleLowerCase("fa");
    if (!term) return conversations;
    return conversations.filter(
      (item) =>
        item.title.toLocaleLowerCase("fa").includes(term) ||
        item.members.some(
          (member) =>
            member.display_name.toLocaleLowerCase("fa").includes(term) ||
            member.department.toLocaleLowerCase("fa").includes(term),
        ),
    );
  }, [conversationSearch, conversations]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!active || sending) return;
    const text = draft.trim();
    if (!text && !attachment) return;
    setSending(true);
    try {
      if (editing) {
        const updated = await chatService.editMessage(editing.id, text);
        setMessages((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
      } else {
        const created = await chatService.sendMessage(
          active.id,
          text,
          replyingTo?.id,
          attachment || undefined,
        );
        setMessages((items) =>
          items.some((item) => item.id === created.id)
            ? items
            : [...items, created],
        );
      }
      setDraft("");
      setAttachment(null);
      setReplyingTo(null);
      setEditing(null);
      setError("");
      await loadConversations(true);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSending(false);
    }
  };

  const handleComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const notifyTyping = () => {
    const now = Date.now();
    if (
      !activeId ||
      !socketRef.current ||
      socketRef.current.readyState !== WebSocket.OPEN ||
      now - typingSentAtRef.current < 900
    )
      return;
    typingSentAtRef.current = now;
    socketRef.current.send(
      JSON.stringify({ type: "typing", conversation_id: activeId }),
    );
  };

  const loadOlder = async () => {
    if (!active || !messages.length) return;
    try {
      const data = await chatService.messages(active.id, messages[0].id);
      setMessages((items) => [...data.items, ...items]);
      setHasMore(data.has_more);
    } catch (requestError) {
      setError(errorText(requestError));
    }
  };

  const deleteMessage = async (message: ChatMessage) => {
    if (!window.confirm("این پیام برای همه حذف شود؟")) return;
    try {
      await chatService.deleteMessage(message.id);
      await loadMessages(message.conversation_id, true, "");
    } catch (requestError) {
      setError(errorText(requestError));
    }
  };

  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    try {
      const reactions = await chatService.react(message.id, emoji);
      setMessages((items) =>
        items.map((item) =>
          item.id === message.id ? { ...item, reactions } : item,
        ),
      );
      setReactionMessageId(null);
    } catch (requestError) {
      setError(errorText(requestError));
    }
  };

  const updateSetting = async (
    values: Partial<
      Pick<Conversation, "is_muted" | "is_pinned" | "is_archived">
    >,
  ) => {
    if (!active) return;
    try {
      await chatService.updateConversation(active.id, values);
      if (values.is_archived !== undefined) setActiveId(null);
      await loadConversations(true);
    } catch (requestError) {
      setError(errorText(requestError));
    }
  };

  return (
    <AppShell>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
        {error && (
          <div className="flex items-center justify-between bg-red-50 px-4 py-2.5 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>
              <X size={17} />
            </button>
          </div>
        )}
        <div className="flex h-[calc(100vh-8rem)] min-h-[560px]">
          <aside
            className={`${active ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-l border-slate-200 md:w-[340px]`}
          >
            <header className="border-b border-slate-100 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-extrabold text-slate-900">
                    گفتگوی درون‌سازمانی
                  </h1>
                  <p className="mt-1 text-xs text-slate-500">
                    ارتباط امن با همکاران
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewChatOpen(true)}
                  title="گفتگوی جدید"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-200 transition hover:bg-red-700"
                >
                  <Plus size={21} />
                </button>
              </div>
              <label className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-red-100">
                <Search size={18} className="text-slate-400" />
                <input
                  value={conversationSearch}
                  onChange={(event) => setConversationSearch(event.target.value)}
                  placeholder="جستجو در گفتگوها"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowArchived((value) => !value)}
                className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-red-600"
              >
                <Archive size={15} />
                {showArchived ? "بازگشت به گفتگوها" : "گفتگوهای بایگانی‌شده"}
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-slate-400">
                  <Loader2 className="animate-spin" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                  <div className="mb-4 rounded-3xl bg-red-50 p-5 text-red-500">
                    <MessageCircle size={34} />
                  </div>
                  <p className="font-bold text-slate-700">
                    {showArchived ? "بایگانی خالی است" : "هنوز گفتگویی ندارید"}
                  </p>
                  {!showArchived && (
                    <button
                      type="button"
                      onClick={() => setNewChatOpen(true)}
                      className="mt-3 text-sm font-semibold text-red-600"
                    >
                      شروع گفتگوی جدید
                    </button>
                  )}
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveId(conversation.id)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-right transition ${
                      activeId === conversation.id
                        ? "bg-red-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="relative shrink-0">
                      {conversation.kind === "group" ? (
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 font-bold text-white">
                        <Users size={21} />
                        </span>
                      ) : (
                        <UserAvatar
                          name={conversation.title}
                          avatarUrl={conversation.members.find((member) => member.id !== user?.id)?.avatar_url}
                          className="h-12 w-12 rounded-2xl"
                          fallbackClassName="bg-gradient-to-br from-red-500 to-red-700 text-white"
                        />
                      )}
                      {conversation.unread_count > 0 && (
                        <span className="absolute -bottom-1 -left-1 min-w-5 rounded-full border-2 border-white bg-red-600 px-1 text-center text-[10px] leading-4 text-white">
                          {conversation.unread_count.toLocaleString("fa-IR")}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {conversation.title}
                        </p>
                        {conversation.is_pinned && (
                          <Pin size={12} className="text-red-500" />
                        )}
                        {conversation.is_muted && (
                          <VolumeX size={12} className="text-slate-400" />
                        )}
                        <span className="mr-auto shrink-0 text-[10px] text-slate-400">
                          {conversation.last_message
                            ? formatListTime(
                                conversation.last_message.created_at,
                              )
                            : ""}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {conversation.last_message?.deleted_at
                          ? "پیام حذف شده"
                          : conversation.last_message?.attachment
                            ? `📎 ${conversation.last_message.attachment.name}`
                            : conversation.last_message?.body ||
                              (conversation.kind === "group"
                                ? `${conversation.members.length.toLocaleString("fa-IR")} عضو`
                                : "گفتگو را آغاز کنید")}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section
            className={`${active ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-slate-50/70`}
          >
            {!active ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-5 rounded-[2rem] bg-white p-7 text-red-500 shadow-sm">
                  <MessageCircle size={48} />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800">
                  یک گفتگو انتخاب کنید
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-7 text-slate-500">
                  از فهرست همکاران یک گفتگوی جدید بسازید یا یکی از گفتگوهای
                  قبلی را ادامه دهید.
                </p>
              </div>
            ) : (
              <>
                <header className="flex h-[73px] items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 md:hidden"
                  >
                    <ArrowRight size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoOpen(true)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-right"
                  >
                    {active.kind === "group" ? (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 font-bold text-white">
                        <Users size={20} />
                      </div>
                    ) : (
                      <UserAvatar
                        name={active.title}
                        avatarUrl={active.members.find((member) => member.id !== user?.id)?.avatar_url}
                        className="h-11 w-11 rounded-2xl"
                        fallbackClassName="bg-red-600 text-white"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-800">
                        {active.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {typingText ||
                          (active.kind === "group"
                          ? `${active.members.length.toLocaleString("fa-IR")} عضو`
                          : active.members.find(
                              (member) => member.id !== user?.id,
                            )?.job_title || "همکار سازمانی")}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMessageSearch((value) => !value)}
                    className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100"
                    title="جستجو در پیام‌ها"
                  >
                    <Search size={19} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoOpen(true)}
                    className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100"
                    title="جزئیات گفتگو"
                  >
                    <MoreVertical size={19} />
                  </button>
                </header>

                {showMessageSearch && (
                  <div className="border-b bg-white px-4 py-2.5">
                    <label className="mx-auto flex max-w-xl items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
                      <Search size={16} className="text-slate-400" />
                      <input
                        autoFocus
                        value={messageSearch}
                        onChange={(event) => setMessageSearch(event.target.value)}
                        placeholder="عبارتی از متن پیام را بنویسید..."
                        className="flex-1 bg-transparent text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowMessageSearch(false);
                          setMessageSearch("");
                          void loadMessages(active.id, false, "");
                        }}
                      >
                        <X size={16} />
                      </button>
                    </label>
                  </div>
                )}

                <div
                  className="chat-scroll flex-1 overflow-y-auto px-3 py-5 sm:px-6"
                  onClick={() => {
                    setOpenMenuId(null);
                    setReactionMessageId(null);
                  }}
                >
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center text-red-500">
                      <Loader2 className="animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                      <MessageCircle
                        size={40}
                        className="mb-3 text-slate-300"
                      />
                      <p className="font-semibold">
                        {messageSearch
                          ? "پیامی با این عبارت پیدا نشد"
                          : "اولین پیام را شما بفرستید"}
                      </p>
                    </div>
                  ) : (
                    <>
                      {hasMore && !messageSearch && (
                        <div className="mb-4 text-center">
                          <button
                            type="button"
                            onClick={() => void loadOlder()}
                            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-red-600 shadow-sm"
                          >
                            نمایش پیام‌های قدیمی‌تر
                          </button>
                        </div>
                      )}
                      {messages.map((message) => {
                        const mine = message.sender.id === user?.id;
                        return (
                          <article
                            key={message.id}
                            className={`group relative mb-3 flex items-end gap-2 ${
                              mine ? "justify-start" : "justify-end"
                            }`}
                          >
                            {!mine && (
                              <UserAvatar
                                name={message.sender.display_name || message.sender.username}
                                avatarUrl={message.sender.avatar_url}
                                className="h-8 w-8 rounded-lg"
                              />
                            )}
                            <div
                              className={`relative max-w-[86%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[70%] ${
                                message.deleted_at
                                  ? "border border-dashed border-slate-300 bg-slate-100 text-slate-400"
                                  : mine
                                    ? "rounded-br-md bg-red-600 text-white"
                                    : "rounded-bl-md border border-slate-100 bg-white text-slate-800"
                              }`}
                            >
                              {!mine && active.kind === "group" && (
                                <p className="mb-1 text-xs font-bold text-red-600">
                                  {message.sender.display_name ||
                                    message.sender.username}
                                </p>
                              )}
                              {message.is_forwarded && !message.deleted_at && (
                                <p
                                  className={`mb-1 flex items-center gap-1 text-[11px] ${
                                    mine ? "text-red-100" : "text-slate-400"
                                  }`}
                                >
                                  <Forward size={12} />
                                  هدایت‌شده
                                </p>
                              )}
                              {message.reply_to && !message.deleted_at && (
                                <button
                                  type="button"
                                  className={`mb-2 block w-full rounded-xl border-r-4 p-2 text-right text-xs ${
                                    mine
                                      ? "border-white/70 bg-red-700/45 text-red-50"
                                      : "border-red-400 bg-slate-50 text-slate-600"
                                  }`}
                                >
                                  <span className="block font-bold">
                                    {message.reply_to.sender_name}
                                  </span>
                                  <span className="mt-0.5 block max-w-xs truncate">
                                    {message.reply_to.body ||
                                      (message.reply_to.has_attachment
                                        ? "فایل پیوست"
                                        : "")}
                                  </span>
                                </button>
                              )}
                              {message.deleted_at ? (
                                <p className="flex items-center gap-2 text-sm italic">
                                  <Trash2 size={14} />
                                  پیام حذف شده است
                                </p>
                              ) : (
                                <>
                                  {message.body && (
                                    <p className="whitespace-pre-wrap break-words text-sm leading-7">
                                      {message.body}
                                    </p>
                                  )}
                                  {message.attachment && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void chatService.downloadAttachment(
                                          message,
                                        )
                                      }
                                      className={`mt-2 flex w-full items-center gap-3 rounded-xl p-2.5 text-right ${
                                        mine
                                          ? "bg-white/15 hover:bg-white/20"
                                          : "bg-slate-50 hover:bg-slate-100"
                                      }`}
                                    >
                                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-red-600">
                                        <FileIcon size={19} />
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block max-w-[210px] truncate text-xs font-bold">
                                          {message.attachment.name}
                                        </span>
                                        <span
                                          className={`mt-1 block text-[10px] ${
                                            mine
                                              ? "text-red-100"
                                              : "text-slate-400"
                                          }`}
                                        >
                                          {fileSize(message.attachment.size)}
                                        </span>
                                      </span>
                                      <Download size={17} />
                                    </button>
                                  )}
                                </>
                              )}
                              <div
                                className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                                  mine ? "text-red-100" : "text-slate-400"
                                }`}
                              >
                                {message.edited_at && <span>ویرایش‌شده</span>}
                                <span>{formatTime(message.created_at)}</span>
                                {mine &&
                                  (active.members.some(
                                    (member) =>
                                      member.id !== user?.id &&
                                      (member.last_read_message_id || 0) >=
                                        message.id,
                                  ) ? (
                                    <CheckCheck size={13} />
                                  ) : (
                                    <Check size={13} />
                                  ))}
                              </div>

                              {message.reactions.length > 0 && (
                                <div
                                  className={`absolute -bottom-4 flex gap-1 ${
                                    mine ? "right-2" : "left-2"
                                  }`}
                                >
                                  {message.reactions.map((reaction) => (
                                    <button
                                      type="button"
                                      title={reaction.users.join("، ")}
                                      key={reaction.emoji}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void toggleReaction(
                                          message,
                                          reaction.emoji,
                                        );
                                      }}
                                      className={`rounded-full border bg-white px-1.5 py-0.5 text-[11px] shadow-sm ${
                                        reaction.user_ids.includes(user?.id || 0)
                                          ? "border-red-300"
                                          : "border-slate-200"
                                      }`}
                                    >
                                      {reaction.emoji}{" "}
                                      {reaction.user_ids.length.toLocaleString(
                                        "fa-IR",
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {!message.deleted_at && (
                              <div className="relative opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenMenuId(
                                      openMenuId === message.id
                                        ? null
                                        : message.id,
                                    );
                                  }}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                                >
                                  <ChevronDown size={16} />
                                </button>
                                {openMenuId === message.id && (
                                  <div
                                    onClick={(event) => event.stopPropagation()}
                                    className={`absolute bottom-7 z-20 w-40 overflow-hidden rounded-2xl border bg-white py-1.5 text-sm text-slate-700 shadow-xl ${
                                      mine ? "right-0" : "left-0"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyingTo(message);
                                        setEditing(null);
                                        setOpenMenuId(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
                                    >
                                      <Reply size={15} /> پاسخ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setForwardMessage(message);
                                        setOpenMenuId(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
                                    >
                                      <Forward size={15} /> هدایت
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReactionMessageId(message.id);
                                        setOpenMenuId(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
                                    >
                                      <Smile size={15} /> واکنش
                                    </button>
                                    {mine && message.body && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditing(message);
                                          setReplyingTo(null);
                                          setDraft(message.body);
                                          setOpenMenuId(null);
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
                                      >
                                        <Pencil size={15} /> ویرایش
                                      </button>
                                    )}
                                    {mine && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void deleteMessage(message)
                                        }
                                        className="flex w-full items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50"
                                      >
                                        <Trash2 size={15} /> حذف
                                      </button>
                                    )}
                                  </div>
                                )}
                                {reactionMessageId === message.id && (
                                  <div
                                    onClick={(event) => event.stopPropagation()}
                                    className={`absolute bottom-7 z-20 flex gap-1 rounded-full border bg-white p-1.5 shadow-xl ${
                                      mine ? "right-0" : "left-0"
                                    }`}
                                  >
                                    {REACTIONS.map((emoji) => (
                                      <button
                                        type="button"
                                        key={emoji}
                                        onClick={() =>
                                          void toggleReaction(message, emoji)
                                        }
                                        className="rounded-full p-1 text-lg hover:bg-slate-100"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {!messageSearch && (
                  <footer className="border-t border-slate-200 bg-white p-3 sm:p-4">
                    {(replyingTo || editing || attachment) && (
                      <div className="mb-2 flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs">
                        <div className="h-8 w-1 rounded-full bg-red-500" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-red-600">
                            {editing
                              ? "ویرایش پیام"
                              : attachment
                                ? "فایل پیوست"
                                : `پاسخ به ${
                                    replyingTo?.sender.display_name ||
                                    replyingTo?.sender.username
                                  }`}
                          </p>
                          <p className="mt-0.5 truncate text-slate-500">
                            {attachment?.name ||
                              editing?.body ||
                              replyingTo?.body ||
                              "فایل پیوست"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(null);
                            setEditing(null);
                            setAttachment(null);
                            if (editing) setDraft("");
                          }}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
                        >
                          <X size={17} />
                        </button>
                      </div>
                    )}
                    <form
                      onSubmit={(event) => void send(event)}
                      className="flex items-end gap-2"
                    >
                      {!editing && (
                        <>
                          <input
                            ref={fileRef}
                            type="file"
                            className="hidden"
                            onChange={(event) =>
                              setAttachment(event.target.files?.[0] || null)
                            }
                          />
                          <button
                            type="button"
                            title="افزودن فایل (حداکثر ۱۵ مگابایت)"
                            onClick={() => fileRef.current?.click()}
                            className="mb-1 rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                          >
                            <Paperclip size={20} />
                          </button>
                        </>
                      )}
                      <textarea
                        value={draft}
                        onChange={(event) => {
                          setDraft(event.target.value);
                          notifyTyping();
                        }}
                        onKeyDown={handleComposerKey}
                        rows={1}
                        maxLength={5000}
                        placeholder={
                          editing ? "متن جدید پیام..." : "پیام خود را بنویسید..."
                        }
                        className="max-h-32 min-h-[46px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
                      />
                      <button
                        type="submit"
                        disabled={
                          sending ||
                          (!draft.trim() && !attachment) ||
                          (!!editing && !draft.trim())
                        }
                        className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-white shadow-md shadow-red-200 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sending ? (
                          <Loader2 size={19} className="animate-spin" />
                        ) : editing ? (
                          <Check size={20} />
                        ) : (
                          <Send size={19} className="rotate-180" />
                        )}
                      </button>
                    </form>
                    <p className="mt-1.5 px-12 text-[10px] text-slate-400">
                      Enter برای ارسال، Shift + Enter برای خط جدید
                    </p>
                  </footer>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {newChatOpen && (
        <NewConversationModal
          users={users}
          onClose={() => setNewChatOpen(false)}
          onCreated={async (conversation) => {
            setNewChatOpen(false);
            setShowArchived(false);
            await loadConversations(true);
            setActiveId(conversation.id);
          }}
          onError={setError}
        />
      )}

      {forwardMessage && (
        <ForwardModal
          message={forwardMessage}
          conversations={conversations.filter((item) => !item.is_archived)}
          onClose={() => setForwardMessage(null)}
          onDone={() => {
            setForwardMessage(null);
            void loadConversations(true);
          }}
          onError={setError}
        />
      )}

      {infoOpen && active && (
        <ConversationInfoModal
          conversation={active}
          users={users}
          currentUserId={user?.id || 0}
          onClose={() => setInfoOpen(false)}
          onChanged={async () => {
            await loadConversations(true);
            await loadMessages(active.id, true, "");
          }}
          onSetting={updateSetting}
          onError={setError}
        />
      )}
    </AppShell>
  );
}

function NewConversationModal({
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
        <div className="mb-3 flex rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setGroup(false);
              setSelected((items) => items.slice(0, 1));
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
              !group ? "bg-white text-red-600 shadow-sm" : "text-slate-500"
            }`}
          >
            گفتگوی شخصی
          </button>
          <button
            type="button"
            onClick={() => setGroup(true)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
              group ? "bg-white text-red-600 shadow-sm" : "text-slate-500"
            }`}
          >
            ساخت گروه
          </button>
        </div>
        {group && (
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={256}
            placeholder="نام گروه"
            className="mb-3 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-red-300"
          />
        )}
        <label className="flex items-center gap-2 rounded-xl border px-3 py-2.5">
          <Search size={17} className="text-slate-400" />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجوی نام، واحد یا نام کاربری"
            className="flex-1 text-sm outline-none"
          />
        </label>
      </div>
      <div className="max-h-[45vh] overflow-y-auto border-y p-2">
        {filtered.map((item) => {
          const checked = selected.includes(item.id);
          return (
            <button
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
              className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-right hover:bg-slate-50"
            >
              <UserAvatar
                name={item.display_name || item.username}
                avatarUrl={item.avatar_url}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-800">
                  {item.display_name || item.username}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {[item.job_title, item.department].filter(Boolean).join(" • ")}
                </span>
              </span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                  checked
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-slate-300"
                }`}
              >
                {checked && <Check size={13} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between p-4">
        <span className="text-xs text-slate-500">
          {selected.length.toLocaleString("fa-IR")} نفر انتخاب شده
        </span>
        <button
          type="button"
          onClick={() => void create()}
          disabled={
            !selected.length || (group && !title.trim()) || submitting
          }
          className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          ایجاد گفتگو
        </button>
      </div>
    </Modal>
  );
}

function ForwardModal({
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
            <button
              type="button"
              key={item.id}
              onClick={() =>
                setSelected((values) =>
                  checked
                    ? values.filter((id) => id !== item.id)
                    : [...values, item.id],
                )
              }
              className="flex w-full items-center gap-3 rounded-2xl p-3 hover:bg-slate-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 font-bold text-red-600">
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
                  checked ? "border-red-600 bg-red-600 text-white" : ""
                }`}
              >
                {checked && <Check size={13} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end border-t p-4">
        <button
          type="button"
          disabled={!selected.length || submitting}
          onClick={() => void submit()}
          className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Forward size={16} />
          )}
          هدایت
        </button>
      </div>
    </Modal>
  );
}

function ConversationInfoModal({
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
  const availableUsers = users.filter(
    (item) => !conversation.members.some((member) => member.id === item.id),
  );

  const rename = async () => {
    if (!title.trim() || title.trim() === conversation.title) return;
    try {
      await chatService.renameGroup(conversation.id, title);
      await onChanged();
    } catch (error) {
      onError(errorText(error));
    }
  };

  return (
    <Modal title="جزئیات گفتگو" onClose={onClose}>
      <div className="max-h-[70vh] overflow-y-auto p-5">
        <div className="mb-5 flex flex-col items-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-600 text-2xl font-bold text-white">
            {conversation.kind === "group" ? (
              <Users size={30} />
            ) : (
              initials(conversation.title)
            )}
          </span>
          {conversation.kind === "group" &&
          conversation.role === "owner" ? (
            <div className="mt-3 flex w-full max-w-xs gap-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-center font-bold outline-none"
              />
              <button
                type="button"
                onClick={() => void rename()}
                className="rounded-xl bg-slate-100 p-2.5 text-slate-600"
              >
                <Check size={18} />
              </button>
            </div>
          ) : (
            <p className="mt-3 font-extrabold text-slate-800">
              {conversation.title}
            </p>
          )}
        </div>
        <div className="mb-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() =>
              void onSetting({ is_muted: !conversation.is_muted })
            }
            className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600"
          >
            {conversation.is_muted ? (
              <Volume2 size={20} />
            ) : (
              <VolumeX size={20} />
            )}
            {conversation.is_muted ? "با صدا" : "بی‌صدا"}
          </button>
          <button
            type="button"
            onClick={() =>
              void onSetting({ is_pinned: !conversation.is_pinned })
            }
            className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600"
          >
            <Pin size={20} />
            {conversation.is_pinned ? "برداشتن سنجاق" : "سنجاق"}
          </button>
          <button
            type="button"
            onClick={() => {
              void onSetting({ is_archived: !conversation.is_archived });
              onClose();
            }}
            className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600"
          >
            <Archive size={20} />
            {conversation.is_archived ? "بازگردانی" : "بایگانی"}
          </button>
        </div>
        {conversation.kind === "group" && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">
                اعضا ({conversation.members.length.toLocaleString("fa-IR")})
              </p>
              {conversation.role === "owner" && availableUsers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAddOpen((value) => !value)}
                  className="flex items-center gap-1 text-xs font-bold text-red-600"
                >
                  <UserPlus size={15} />
                  افزودن عضو
                </button>
              )}
            </div>
            {addOpen && (
              <div className="mb-3 max-h-40 overflow-y-auto rounded-2xl border p-2">
                {availableUsers.map((item) => (
                  <button
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
                    className="flex w-full items-center gap-2 rounded-xl p-2 text-right text-sm hover:bg-slate-50"
                  >
                    <Plus size={15} className="text-red-600" />
                    {item.display_name || item.username}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1">
              {conversation.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-slate-50"
                >
                  <UserAvatar
                    name={member.display_name || member.username}
                    avatarUrl={member.avatar_url}
                    className="h-9 w-9 rounded-xl"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {member.display_name || member.username}
                      {member.id === currentUserId ? " (شما)" : ""}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {member.role === "owner"
                        ? "سازنده گروه"
                        : member.department}
                    </span>
                  </span>
                  {conversation.role === "owner" &&
                    member.role !== "owner" && (
                      <button
                        type="button"
                        title="حذف از گروه"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `${member.display_name || member.username} از گروه حذف شود؟`,
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
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
