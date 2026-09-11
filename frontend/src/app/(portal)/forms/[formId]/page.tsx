"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { FormPage } from "@/features/portal";

export default function Page() {
  return <ProtectedFeature><FormPage /></ProtectedFeature>;
}
