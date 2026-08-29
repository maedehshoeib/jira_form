"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { ContractReportForm } from "@/features/contracts";

export default function Page() {
  return <ProtectedFeature><ContractReportForm /></ProtectedFeature>;
}
