"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { ContractList } from "@/features/contracts";

export default function Page() {
  return <ProtectedFeature><ContractList /></ProtectedFeature>;
}
