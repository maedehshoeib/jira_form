"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { LetterReportPage } from "@/features/management";

export default function Page() {
  return <ProtectedFeature><LetterReportPage letterType="external" /></ProtectedFeature>;
}
