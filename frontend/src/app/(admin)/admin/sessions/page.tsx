"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { AdminSessionsPage } from "@/features/admin";

export default function Page() {
  return <ProtectedFeature admin><AdminSessionsPage /></ProtectedFeature>;
}
