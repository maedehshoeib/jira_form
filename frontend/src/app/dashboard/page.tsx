"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { UserDashboardPage } from "@/features/dashboard";

export default function Page() {
  return <ProtectedFeature><UserDashboardPage /></ProtectedFeature>;
}
