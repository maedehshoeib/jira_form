"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { AdminDashboardPage } from "@/features/admin";

export default function Page() {
  return <ProtectedFeature admin><AdminDashboardPage /></ProtectedFeature>;
}
