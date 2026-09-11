"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { DepartmentPage } from "@/features/portal";

export default function Page() {
  return <ProtectedFeature><DepartmentPage /></ProtectedFeature>;
}
