"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { TimeSheetPage } from "@/features/timesheet";

export default function Page() {
  return <ProtectedFeature><TimeSheetPage /></ProtectedFeature>;
}
