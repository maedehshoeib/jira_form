"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { ManagementWorkflowHome } from "@/features/management";

export default function Page() {
  return <ProtectedFeature><ManagementWorkflowHome letterType="internal" /></ProtectedFeature>;
}
