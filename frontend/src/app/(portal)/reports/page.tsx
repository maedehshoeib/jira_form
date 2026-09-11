"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { ReportsHome } from "@/features/reports";

export default function Page() {
  return <ProtectedFeature><ReportsHome /></ProtectedFeature>;
}
