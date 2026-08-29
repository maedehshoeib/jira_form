"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { AdminDutiesPage } from "@/features/admin";

export default function Page() {
  return <ProtectedFeature admin><AdminDutiesPage /></ProtectedFeature>;
}
