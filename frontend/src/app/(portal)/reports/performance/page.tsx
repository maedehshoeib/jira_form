"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { PerformanceReports } from "@/features/reports";

export default function Page() {
  return <ProtectedFeature><PerformanceReports /></ProtectedFeature>;
}
