import client from "../api/client";

export type ChatUser = {
  id: number;
  username: string;
  display_name: string;
  department: string;
  job_title: string;
  extension: string;
  avatar_url: string;
  role?: "owner" | "member";
  last_read_message_id?: number | null;
};

export type ChatReaction = {
  emoji: string;
  user_ids: number[];
  users: string[];
};

export type ChatMessage = {
  id: number;
  conversation_id: number;
  sender: ChatUser;
  body: string;
  reply_to: {
    id: number;
    body: string;
    sender_name: string;
    has_attachment: boolean;
  } | null;
  is_forwarded: boolean;
  attachment: {
    name: string;
    type: string;
    size: number;
    url: string;
  } | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reactions: ChatReaction[];
};

export type Conversation = {
  id: number;
  kind: "direct" | "group";
  title: string;
  members: ChatUser[];
  last_message: ChatMessage | null;
  unread_count: number;
  is_muted: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  role: "owner" | "member";
  created_at: string;
  updated_at: string;
};

export type MessagePage = {
  items: ChatMessage[];
  has_more: boolean;
  next_before_id: number | null;
};

export const chatService = {
  async users(search = "") {
    const { data } = await client.get<ChatUser[]>("/chat/users", {
      params: { search },
    });
    return data;
  },

  async conversations(archived = false) {
    const { data } = await client.get<Conversation[]>("/chat/conversations", {
      params: { archived },
    });
    return data;
  },

  async createConversation(
    participantIds: number[],
    kind: "direct" | "group" = "direct",
    title = "",
  ) {
    const { data } = await client.post<Conversation>("/chat/conversations", {
      participant_ids: participantIds,
      kind,
      title,
    });
    return data;
  },

  async messages(conversationId: number, beforeId?: number, search = "") {
    const { data } = await client.get<MessagePage>(
      `/chat/conversations/${conversationId}/messages`,
      { params: { before_id: beforeId, search } },
    );
    return data;
  },

  async sendMessage(
    conversationId: number,
    body: string,
    replyToId?: number,
    attachment?: File,
  ) {
    const form = new FormData();
    form.append("body", body);
    if (replyToId) form.append("reply_to_id", String(replyToId));
    if (attachment) form.append("attachment", attachment);
    const { data } = await client.post<ChatMessage>(
      `/chat/conversations/${conversationId}/messages`,
      form,
    );
    return data;
  },

  async editMessage(messageId: number, body: string) {
    const { data } = await client.patch<ChatMessage>(
      `/chat/messages/${messageId}`,
      { body },
    );
    return data;
  },

  async deleteMessage(messageId: number) {
    await client.delete(`/chat/messages/${messageId}`);
  },

  async forwardMessage(messageId: number, conversationIds: number[]) {
    await client.post(`/chat/messages/${messageId}/forward`, {
      conversation_ids: conversationIds,
    });
  },

  async react(messageId: number, emoji: string) {
    const { data } = await client.post<{ reactions: ChatReaction[] }>(
      `/chat/messages/${messageId}/reactions`,
      { emoji },
    );
    return data.reactions;
  },

  async markRead(conversationId: number) {
    await client.post(`/chat/conversations/${conversationId}/read`);
  },

  async updateConversation(
    conversationId: number,
    values: Partial<
      Pick<Conversation, "is_muted" | "is_pinned" | "is_archived">
    >,
  ) {
    const { data } = await client.patch<Conversation>(
      `/chat/conversations/${conversationId}`,
      values,
    );
    return data;
  },

  async renameGroup(conversationId: number, title: string) {
    await client.patch(`/chat/conversations/${conversationId}/group`, { title });
  },

  async addParticipants(conversationId: number, userIds: number[]) {
    await client.post(`/chat/conversations/${conversationId}/participants`, {
      user_ids: userIds,
    });
  },

  async removeParticipant(conversationId: number, userId: number) {
    await client.delete(
      `/chat/conversations/${conversationId}/participants/${userId}`,
    );
  },

  async downloadAttachment(message: ChatMessage) {
    if (!message.attachment) return;
    const response = await client.get(message.attachment.url, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = message.attachment.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};
