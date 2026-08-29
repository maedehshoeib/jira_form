"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { InternalChatPage } from "@/features/chat";

export default function Page() {
  return <ProtectedFeature><InternalChatPage /></ProtectedFeature>;
}
