"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { ContractsArchiveHome } from "@/features/contracts";

export default function Page() {
  return <ProtectedFeature><ContractsArchiveHome /></ProtectedFeature>;
}
