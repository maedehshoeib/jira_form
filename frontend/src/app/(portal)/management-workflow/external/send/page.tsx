"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { SendLetterPage } from "@/features/management";

export default function Page() {
  return <ProtectedFeature><SendLetterPage letterType="external" /></ProtectedFeature>;
}
