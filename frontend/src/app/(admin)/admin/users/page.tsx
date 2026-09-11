"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { AdminUsersPage } from "@/features/admin";

export default function Page() {
  return <ProtectedFeature admin><AdminUsersPage /></ProtectedFeature>;
}
