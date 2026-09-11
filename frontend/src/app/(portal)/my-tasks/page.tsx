"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { MyTasksPage } from "@/features/tasks";

export default function Page() {
  return <ProtectedFeature><MyTasksPage /></ProtectedFeature>;
}
