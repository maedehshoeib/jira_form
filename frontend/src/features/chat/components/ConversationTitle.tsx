import UserDisplayName from "@/components/UserDisplayName";

import type { Conversation } from "../api/chat-service";
import { conversationPeer } from "../utils";

export function ConversationTitle({
  conversation,
  currentUserId,
  className,
}: {
  conversation: Conversation;
  currentUserId?: number;
  className?: string;
}) {
  const peer = conversationPeer(conversation, currentUserId);
  if (peer) {
    return <UserDisplayName user={peer} className={className} />;
  }
  return <span className={className}>{conversation.title}</span>;
}
